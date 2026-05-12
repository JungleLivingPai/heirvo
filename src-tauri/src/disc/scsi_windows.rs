//! Windows SCSI pass-through implementation for raw DVD sector reads.
//!
//! Uses `DeviceIoControl` with `IOCTL_SCSI_PASS_THROUGH_DIRECT` to send
//! SCSI MMC commands directly to the optical drive:
//! - READ(10)        — opcode 0x28, used for raw sector reads
//! - READ CAPACITY   — opcode 0x25, returns total LBAs and sector size
//! - INQUIRY         — opcode 0x12, returns vendor/model/firmware
//!
//! Reference: SCSI Multimedia Commands (MMC-6) specification.
//!
//! ## Safety
//! All `DeviceIoControl` calls go through `unsafe` blocks; SENSE buffers and
//! status codes are validated before returning data to the caller.

use crate::disc::drive::{DriveCapabilities, DriveInfo};
use crate::disc::sector::{
    ReadOptions, SectorError, SectorReadResult, SectorReader, DVD_SECTOR_SIZE, MAX_BLOCK_SECTORS,
};
use std::io;
use std::os::windows::io::AsRawHandle;
use std::time::Instant;

/// Page-aligned heap buffer for SCSI DMA transfers.
///
/// Windows' `IOCTL_SCSI_PASS_THROUGH_DIRECT` requires the data buffer to satisfy
/// the host adapter's alignment mask (often page-sized). Plain `Vec<u8>` only
/// guarantees byte alignment, which can cause `ERROR_INVALID_PARAMETER` on
/// alignment-sensitive controllers — particularly with multi-sector transfers.
struct AlignedBuffer {
    ptr: *mut u8,
    layout: std::alloc::Layout,
    len: usize,
}

impl AlignedBuffer {
    fn new(len: usize, align: usize) -> Self {
        let layout = std::alloc::Layout::from_size_align(len, align)
            .expect("invalid layout for AlignedBuffer");
        // SAFETY: layout has size >= 1 in practice (we never request 0); we zero-init below.
        let ptr = unsafe { std::alloc::alloc_zeroed(layout) };
        if ptr.is_null() {
            std::alloc::handle_alloc_error(layout);
        }
        Self { ptr, layout, len }
    }

    fn as_mut_slice(&mut self) -> &mut [u8] {
        // SAFETY: ptr was allocated for `len` bytes and is non-null.
        unsafe { std::slice::from_raw_parts_mut(self.ptr, self.len) }
    }

    fn as_slice(&self) -> &[u8] {
        // SAFETY: ptr was allocated for `len` bytes and is non-null.
        unsafe { std::slice::from_raw_parts(self.ptr, self.len) }
    }
}

impl Drop for AlignedBuffer {
    fn drop(&mut self) {
        // SAFETY: matched alloc/dealloc with the same layout.
        unsafe { std::alloc::dealloc(self.ptr, self.layout) };
    }
}

unsafe impl Send for AlignedBuffer {}
unsafe impl Sync for AlignedBuffer {}

use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, GENERIC_READ, GENERIC_WRITE, HANDLE};
use windows::Win32::Storage::FileSystem::{
    CreateFileW, FILE_FLAG_NO_BUFFERING, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
};
use windows::Win32::System::IO::DeviceIoControl;

/// IOCTL_SCSI_PASS_THROUGH_DIRECT control code.
const IOCTL_SCSI_PASS_THROUGH_DIRECT: u32 = 0x4D014;
/// IOCTL_STORAGE_CHECK_VERIFY — returns success iff media is present.
/// Doesn't spin up the drive, so safe to poll repeatedly.
const IOCTL_STORAGE_CHECK_VERIFY: u32 = 0x2D4800;

/// SCSI READ(10) opcode — reads 10-byte LBA range.
const SCSI_OP_READ_10: u8 = 0x28;
/// SCSI READ CAPACITY(10) opcode.
const SCSI_OP_READ_CAPACITY: u8 = 0x25;
/// SCSI INQUIRY opcode.
const SCSI_OP_INQUIRY: u8 = 0x12;

const SCSI_IOCTL_DATA_IN: u8 = 1;
#[allow(dead_code)]
const SCSI_IOCTL_DATA_OUT: u8 = 0;

/// SCSI sense key extracted from the SENSE buffer (bytes [2] & 0x0F).
const SENSE_KEY_NO_SENSE: u8 = 0x00;
const SENSE_KEY_NOT_READY: u8 = 0x02;
const SENSE_KEY_MEDIUM_ERROR: u8 = 0x03;
const SENSE_KEY_HARDWARE_ERROR: u8 = 0x04;
const SENSE_KEY_ILLEGAL_REQUEST: u8 = 0x05;

#[repr(C)]
#[derive(Default)]
struct ScsiPassThroughDirect {
    length: u16,
    scsi_status: u8,
    path_id: u8,
    target_id: u8,
    lun: u8,
    cdb_length: u8,
    sense_info_length: u8,
    data_in: u8,
    data_transfer_length: u32,
    timeout_value: u32,
    data_buffer: *mut std::ffi::c_void,
    sense_info_offset: u32,
    cdb: [u8; 16],
}

#[repr(C)]
struct ScsiPassThroughDirectWithBuffer {
    sptd: ScsiPassThroughDirect,
    /// Padding so SENSE buffer is properly aligned after the struct.
    _padding: u32,
    sense_buffer: [u8; 32],
}

fn create_handle(path: &str) -> io::Result<HANDLE> {
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        CreateFileW(
            PCWSTR(wide.as_ptr()),
            (GENERIC_READ | GENERIC_WRITE).0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_NO_BUFFERING,
            None,
        )
    }
    .map_err(|e| io::Error::other(format!("CreateFileW({path}): {e}")))
}

/// Open a raw handle to an optical drive. The path should be `\\.\X:` form.
pub fn open_drive(path: &str) -> io::Result<DriveHandle> {
    let handle = create_handle(path)?;
    Ok(DriveHandle {
        handle: parking_lot::Mutex::new(handle),
        path: path.to_string(),
    })
}

pub struct DriveHandle {
    /// Mutex-protected so we can transparently re-open the handle if Windows
    /// reports the device disconnected (common with bus-powered USB drives
    /// that brown out under load).
    handle: parking_lot::Mutex<HANDLE>,
    pub path: String,
}

impl DriveHandle {
    /// Close the current handle and open a fresh one. Used as a recovery
    /// step when the OS reports the drive vanished mid-IOCTL.
    pub fn reopen(&self) -> io::Result<()> {
        let mut guard = self.handle.lock();
        let old = *guard;
        if !old.is_invalid() {
            unsafe {
                let _ = CloseHandle(old);
            }
        }
        let new = create_handle(&self.path)?;
        *guard = new;
        Ok(())
    }

    /// Get the current raw handle for an IOCTL call.
    pub fn current(&self) -> HANDLE {
        *self.handle.lock()
    }
}

impl AsRawHandle for DriveHandle {
    fn as_raw_handle(&self) -> std::os::windows::io::RawHandle {
        self.current().0 as _
    }
}

impl Drop for DriveHandle {
    fn drop(&mut self) {
        let h = *self.handle.lock();
        if !h.is_invalid() {
            unsafe {
                let _ = CloseHandle(h);
            }
        }
    }
}

unsafe impl Send for DriveHandle {}
unsafe impl Sync for DriveHandle {}

// Windows error codes that indicate the drive has likely become unresponsive
// or temporarily disconnected (typical on bus-powered USB DVD drives under
// power stress). When we see these, a re-open + brief pause often recovers:
//
// - 0x80070079 ERROR_SEM_TIMEOUT       — kernel I/O timeout
// - 0x80070037 ERROR_DEV_NOT_EXIST     — drive vanished mid-IOCTL
// - 0x8007001F ERROR_GEN_FAILURE       — drive in error state
// - 0x80070015 ERROR_NOT_READY         — drive spinning up / not ready

fn is_drive_disconnect_error(e: &io::Error) -> bool {
    let s = e.to_string();
    s.contains("0x80070079")  // ERROR_SEM_TIMEOUT
        || s.contains("0x80070037")  // ERROR_DEV_NOT_EXIST
        || s.contains("0x8007001F")  // ERROR_GEN_FAILURE
        || s.contains("0x80070015")  // ERROR_NOT_READY
}

/// Check whether the drive currently has readable media inserted.
/// Returns `true` for "media present", `false` otherwise. Never spins the drive.
pub fn has_media(drive: &DriveHandle) -> bool {
    let mut bytes_returned: u32 = 0;
    let result = unsafe {
        DeviceIoControl(
            drive.current(),
            IOCTL_STORAGE_CHECK_VERIFY,
            None,
            0,
            None,
            0,
            Some(&mut bytes_returned),
            None,
        )
    };
    result.is_ok()
}

/// Send a SCSI command via IOCTL_SCSI_PASS_THROUGH_DIRECT.
///
/// Returns `(scsi_status, sense_buffer)`. A `scsi_status` of 0 means success.
fn scsi_passthrough(
    drive: &DriveHandle,
    cdb: &[u8],
    data_buf: &mut [u8],
    direction: u8,
    timeout_secs: u32,
) -> io::Result<(u8, [u8; 32])> {
    let mut req = ScsiPassThroughDirectWithBuffer {
        sptd: ScsiPassThroughDirect {
            length: std::mem::size_of::<ScsiPassThroughDirect>() as u16,
            cdb_length: cdb.len() as u8,
            sense_info_length: 32,
            data_in: direction,
            data_transfer_length: data_buf.len() as u32,
            timeout_value: timeout_secs,
            data_buffer: data_buf.as_mut_ptr() as *mut _,
            sense_info_offset: (std::mem::size_of::<ScsiPassThroughDirect>() + 4) as u32,
            ..Default::default()
        },
        _padding: 0,
        sense_buffer: [0u8; 32],
    };
    req.sptd.cdb[..cdb.len()].copy_from_slice(cdb);

    let mut bytes_returned: u32 = 0;
    let result = unsafe {
        DeviceIoControl(
            drive.current(),
            IOCTL_SCSI_PASS_THROUGH_DIRECT,
            Some(&req as *const _ as *const _),
            std::mem::size_of::<ScsiPassThroughDirectWithBuffer>() as u32,
            Some(&mut req as *mut _ as *mut _),
            std::mem::size_of::<ScsiPassThroughDirectWithBuffer>() as u32,
            Some(&mut bytes_returned),
            None,
        )
    };

    if let Err(e) = result {
        return Err(io::Error::other(format!("DeviceIoControl: {e}")));
    }

    Ok((req.sptd.scsi_status, req.sense_buffer))
}

/// Issue an IOCTL with auto-recover on device-disconnect. If the first try
/// returns an error indicating the drive vanished, we wait a beat, re-open
/// the handle, and try once more. Returns the result of the second attempt
/// (or the first if it succeeded or had a non-disconnect error).
fn scsi_passthrough_resilient(
    drive: &DriveHandle,
    cdb: &[u8],
    data_buf: &mut [u8],
    direction: u8,
    timeout_secs: u32,
) -> io::Result<(u8, [u8; 32])> {
    match scsi_passthrough(drive, cdb, data_buf, direction, timeout_secs) {
        Ok(v) => Ok(v),
        Err(e) if is_drive_disconnect_error(&e) => {
            tracing::warn!(
                "drive disconnect detected ({e}); pausing 3s and re-opening handle"
            );
            std::thread::sleep(std::time::Duration::from_secs(3));
            if let Err(re) = drive.reopen() {
                tracing::error!("drive reopen failed: {re}");
                return Err(e);
            }
            tracing::info!("drive re-opened, retrying IOCTL");
            scsi_passthrough(drive, cdb, data_buf, direction, timeout_secs)
        }
        Err(e) => Err(e),
    }
}

/// Map a SCSI sense buffer to our internal `SectorError`.
fn sense_to_error(sense: &[u8; 32]) -> SectorError {
    if sense[0] == 0 {
        return SectorError::Other;
    }
    let key = sense[2] & 0x0F;
    match key {
        SENSE_KEY_NO_SENSE => SectorError::Other,
        SENSE_KEY_NOT_READY => SectorError::HardwareError,
        SENSE_KEY_MEDIUM_ERROR => SectorError::MediumError,
        SENSE_KEY_HARDWARE_ERROR => SectorError::HardwareError,
        SENSE_KEY_ILLEGAL_REQUEST => SectorError::IllegalRequest,
        _ => SectorError::Other,
    }
}

/// Build a SCSI READ(10) CDB.
fn build_read10_cdb(lba: u32, blocks: u16) -> [u8; 10] {
    [
        SCSI_OP_READ_10,
        0,
        ((lba >> 24) & 0xFF) as u8,
        ((lba >> 16) & 0xFF) as u8,
        ((lba >> 8) & 0xFF) as u8,
        (lba & 0xFF) as u8,
        0,
        ((blocks >> 8) & 0xFF) as u8,
        (blocks & 0xFF) as u8,
        0,
    ]
}

pub struct ScsiSectorReader {
    drive: DriveHandle,
    capacity_lba: u64,
}

impl ScsiSectorReader {
    pub fn open(path: &str) -> io::Result<Self> {
        let drive = open_drive(path)?;
        let capacity_lba = read_capacity(&drive)?;
        Ok(Self { drive, capacity_lba })
    }
}

impl SectorReader for ScsiSectorReader {
    fn read_sector(&self, lba: u64, opts: ReadOptions) -> SectorReadResult {
        if lba >= self.capacity_lba {
            return SectorReadResult::err(lba, SectorError::IllegalRequest, 0, 0);
        }

        let timeout_secs = (opts.timeout_ms / 1000).max(5);
        let cdb = build_read10_cdb(lba as u32, 1);
        let mut buf = vec![0u8; DVD_SECTOR_SIZE];
        let mut last_err = SectorError::Other;
        let mut attempts: u8 = 0;
        let started = Instant::now();

        for attempt in 0..=opts.retries {
            attempts = attempt + 1;
            match scsi_passthrough_resilient(&self.drive, &cdb, &mut buf, SCSI_IOCTL_DATA_IN, timeout_secs) {
                Ok((status, sense)) => {
                    if status == 0 {
                        let elapsed = started.elapsed().as_millis() as u32;
                        return SectorReadResult::ok(lba, buf, elapsed);
                    }
                    last_err = sense_to_error(&sense);
                    if matches!(last_err, SectorError::IllegalRequest) {
                        break;
                    }
                }
                Err(e) => {
                    tracing::debug!("SCSI passthrough I/O error at LBA {lba}: {e}");
                    last_err = if e.kind() == io::ErrorKind::TimedOut {
                        SectorError::Timeout
                    } else {
                        SectorError::Other
                    };
                }
            }
        }

        let elapsed = started.elapsed().as_millis() as u32;
        SectorReadResult::err(lba, last_err, attempts, elapsed)
    }

    fn read_block(&self, start_lba: u64, count: u32, opts: ReadOptions) -> Vec<SectorReadResult> {
        if count == 0 {
            return Vec::new();
        }
        if count == 1 || start_lba >= self.capacity_lba {
            return vec![self.read_sector(start_lba, opts)];
        }

        let remaining = self.capacity_lba - start_lba;
        let n = std::cmp::min(count, MAX_BLOCK_SECTORS) as u64;
        let n = std::cmp::min(n, remaining) as u32;

        let timeout_secs = (opts.timeout_ms / 1000).max(5);
        let cdb = build_read10_cdb(start_lba as u32, n as u16);
        // IOCTL_SCSI_PASS_THROUGH_DIRECT requires the data buffer to be aligned
        // to the host adapter's alignment mask — page alignment (4096) satisfies
        // every consumer driver. A bare Vec<u8> only guarantees u8 alignment,
        // which trips ERROR_INVALID_PARAMETER on some controllers.
        let mut buf = AlignedBuffer::new(n as usize * DVD_SECTOR_SIZE, 4096);
        let started = Instant::now();

        let result = scsi_passthrough_resilient(&self.drive, &cdb, buf.as_mut_slice(), SCSI_IOCTL_DATA_IN, timeout_secs);
        let elapsed_ms = started.elapsed().as_millis() as u32;
        match result {
            Ok((0, _)) => {
                let per_sector_ms = elapsed_ms.checked_div(n).unwrap_or(0);
                // Log every 1024 sectors (rough heartbeat) or any unusually slow block.
                if start_lba % 1024 == 0 || elapsed_ms > 200 {
                    tracing::info!("read_block ok: lba={start_lba} n={n} took={elapsed_ms}ms");
                }
                let bytes = buf.as_slice();
                (0..n as usize)
                    .map(|i| {
                        let off = i * DVD_SECTOR_SIZE;
                        let sector = bytes[off..off + DVD_SECTOR_SIZE].to_vec();
                        SectorReadResult::ok(start_lba + i as u64, sector, per_sector_ms)
                    })
                    .collect()
            }
            Ok((status, sense)) => {
                tracing::warn!(
                    "Block read non-zero status {status:#x} sense={:#x} at LBA {start_lba} n={n} took={elapsed_ms}ms; falling back to per-sector",
                    sense[2] & 0x0F
                );
                (0..n as u64)
                    .map(|i| self.read_sector(start_lba + i, opts))
                    .collect()
            }
            Err(e) => {
                tracing::warn!(
                    "Block read I/O error at LBA {start_lba} n={n} took={elapsed_ms}ms: {e}; falling back to per-sector"
                );
                (0..n as u64)
                    .map(|i| self.read_sector(start_lba + i, opts))
                    .collect()
            }
        }
    }

    fn capacity(&self) -> u64 {
        self.capacity_lba
    }
}

/// Issue READ CAPACITY(10) and return total LBAs.
fn read_capacity(drive: &DriveHandle) -> io::Result<u64> {
    let cdb = [SCSI_OP_READ_CAPACITY, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let mut buf = [0u8; 8];
    let (status, sense) = scsi_passthrough(drive, &cdb, &mut buf, SCSI_IOCTL_DATA_IN, 10)?;
    if status != 0 {
        return Err(io::Error::other(
            format!("READ CAPACITY failed, sense key {:#x}", sense[2] & 0x0F),
        ));
    }
    // First 4 bytes = last LBA (big-endian). Add 1 for total count.
    let last_lba = u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]);
    Ok((last_lba as u64) + 1)
}

/// Issue INQUIRY and parse vendor/model/firmware.
fn inquiry(drive: &DriveHandle) -> io::Result<(String, String, String)> {
    let cdb = [SCSI_OP_INQUIRY, 0, 0, 0, 96, 0, 0, 0, 0, 0];
    let mut buf = [0u8; 96];
    let (status, _) = scsi_passthrough(drive, &cdb, &mut buf, SCSI_IOCTL_DATA_IN, 10)?;
    if status != 0 {
        return Ok(("Unknown".into(), "Unknown".into(), "Unknown".into()));
    }
    let trim = |b: &[u8]| -> String {
        String::from_utf8_lossy(b).trim().to_string()
    };
    Ok((trim(&buf[8..16]), trim(&buf[16..32]), trim(&buf[32..36])))
}

/// Enumerate available optical drives by probing every drive letter A:..Z:
/// and checking which ones respond to INQUIRY.
pub fn enumerate_optical_drives() -> io::Result<Vec<DriveInfo>> {
    let mut drives = Vec::new();
    for letter in b'A'..=b'Z' {
        let letter_str = format!("{}:", letter as char);
        let path = format!("\\\\.\\{}", letter_str);
        let drive = match open_drive(&path) {
            Ok(d) => d,
            Err(_) => continue,
        };

        // Try INQUIRY — only optical drives will succeed with peripheral type 0x05.
        let cdb = [SCSI_OP_INQUIRY, 0, 0, 0, 96, 0, 0, 0, 0, 0];
        let mut buf = [0u8; 96];
        match scsi_passthrough(&drive, &cdb, &mut buf, SCSI_IOCTL_DATA_IN, 5) {
            Ok((0, _)) => {
                // Peripheral device type is in low 5 bits of byte 0.
                // 0x05 = CD/DVD-ROM device.
                if (buf[0] & 0x1F) != 0x05 {
                    continue;
                }
                let (vendor, model, firmware) = inquiry(&drive).unwrap_or_default();
                let has_media_flag = has_media(&drive);
                drives.push(DriveInfo {
                    path,
                    letter: letter_str,
                    vendor,
                    model,
                    firmware,
                    capabilities: DriveCapabilities {
                        reads_dvd: true,
                        reads_cd: true,
                        reads_bluray: false,
                        supports_speed_control: true,
                    },
                    has_media: has_media_flag,
                });
            }
            _ => continue,
        }
    }
    Ok(drives)
}
