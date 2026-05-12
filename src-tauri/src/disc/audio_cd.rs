//! Audio CD (CD-DA) support — TOC reading, raw 2352-byte sector extraction,
//! and a tiny WAV writer for dumping recovered tracks to disk.
//!
//! ## SCSI commands used
//! - READ TOC/PMA/ATIP (opcode 0x43) — track table of contents
//! - READ CD          (opcode 0xBE) — raw 2352-byte CD-DA frame extraction (DAE)
//!
//! ## Sector format
//! CD-DA sectors are 2352 bytes of raw 16-bit signed PCM little-endian, two
//! interleaved channels (L,R,L,R...) at 44_100 Hz. 75 sectors per second.

use serde::{Deserialize, Serialize};
use std::io::{self, Write};

/// CD-DA samples per sector (interleaved stereo 16-bit).
pub const CDDA_SECTOR_BYTES: usize = 2352;
/// Sectors per second on a CD.
pub const CDDA_SECTORS_PER_SEC: u32 = 75;
/// CD audio sample rate.
pub const CDDA_SAMPLE_RATE: u32 = 44_100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrack {
    pub number: u8,
    pub start_lba: u32,
    pub end_lba: u32,
    pub duration_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioToc {
    pub tracks: Vec<AudioTrack>,
    /// Lead-out LBA — total disc length in CD-DA frames.
    pub lead_out_lba: u32,
}

/// Build a SCSI READ TOC (opcode 0x43) CDB. Format 0 = TOC by track.
/// Returns descriptors for every track, MSF flag = 0 (LBA addressing).
fn build_read_toc_cdb(allocation_len: u16) -> [u8; 10] {
    [
        0x43, // READ TOC/PMA/ATIP
        0x00, // bit 1 (MSF) = 0 -> LBA addressing
        0x00, // format = 0 (TOC)
        0x00, 0x00, 0x00,
        0x01, // starting track
        ((allocation_len >> 8) & 0xFF) as u8,
        (allocation_len & 0xFF) as u8,
        0x00,
    ]
}

/// Build a SCSI READ CD (opcode 0xBE) CDB requesting the raw 2352-byte
/// user data area of `count` consecutive CD-DA frames starting at `lba`.
///
/// Byte 9 (sub-channel selection) is 0x10 = "user data" only (no sync, no
/// header, no ECC, no C2). Byte 10 = 0 (no sub-channel).
/// Byte 1 expected sector type = 0b001 << 2 = CD-DA enforcement.
fn build_read_cd_cdb(lba: u32, count: u32) -> [u8; 12] {
    [
        0xBE,
        0b0000_0100, // expected sector type = CD-DA (1 << 2)
        ((lba >> 24) & 0xFF) as u8,
        ((lba >> 16) & 0xFF) as u8,
        ((lba >> 8) & 0xFF) as u8,
        (lba & 0xFF) as u8,
        ((count >> 16) & 0xFF) as u8,
        ((count >> 8) & 0xFF) as u8,
        (count & 0xFF) as u8,
        0x10, // user-data only
        0x00,
        0x00,
    ]
}

/// Parse a READ TOC response buffer into our `AudioToc`.
///
/// Layout (Format 0, MSF=0):
/// - bytes [0..2] = TOC data length (BE, excludes itself)
/// - byte [2] = first track #
/// - byte [3] = last track #
/// - then 8-byte descriptors per track + lead-out (track # 0xAA):
///   [0]=reserved, [1]=ADR/control, [2]=track #, [3]=reserved,
///   [4..8]=track start LBA (BE u32)
pub fn parse_toc(buf: &[u8]) -> io::Result<AudioToc> {
    if buf.len() < 4 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "TOC buffer too small"));
    }
    let data_len = u16::from_be_bytes([buf[0], buf[1]]) as usize;
    // total_len = data_len field + 2 (for itself)
    let total_len = data_len + 2;
    if total_len > buf.len() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("TOC data_len {data_len} exceeds buffer {}", buf.len()),
        ));
    }
    let descriptors = &buf[4..total_len];
    if descriptors.len() % 8 != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "TOC descriptors not 8-byte aligned",
        ));
    }

    let mut entries: Vec<(u8, u32, u8)> = Vec::new(); // (track_no, start_lba, control)
    for chunk in descriptors.chunks_exact(8) {
        let control = chunk[1];
        let track_no = chunk[2];
        let lba = u32::from_be_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]);
        entries.push((track_no, lba, control));
    }

    // Lead-out is track 0xAA. Use it to compute end LBAs.
    let lead_out_lba = entries
        .iter()
        .find(|(n, _, _)| *n == 0xAA)
        .map(|(_, lba, _)| *lba)
        .unwrap_or(0);

    let mut tracks: Vec<AudioTrack> = Vec::new();
    let real: Vec<&(u8, u32, u8)> = entries.iter().filter(|(n, _, _)| *n != 0xAA).collect();
    for (i, (n, lba, _control)) in real.iter().enumerate() {
        let next_lba = if i + 1 < real.len() {
            real[i + 1].1
        } else {
            lead_out_lba
        };
        let frames = next_lba.saturating_sub(*lba);
        tracks.push(AudioTrack {
            number: *n,
            start_lba: *lba,
            end_lba: next_lba,
            duration_secs: frames as f32 / CDDA_SECTORS_PER_SEC as f32,
        });
    }

    Ok(AudioToc { tracks, lead_out_lba })
}

/// Write the standard 44-byte WAV / RIFF header for 16-bit signed PCM stereo
/// at 44.1 kHz, followed by `pcm_bytes_total` bytes of PCM data.
///
/// This writes ONLY the header — caller writes the PCM body themselves.
pub fn write_wav_header<W: Write>(w: &mut W, pcm_bytes_total: u32) -> io::Result<()> {
    let channels: u16 = 2;
    let sample_rate: u32 = CDDA_SAMPLE_RATE;
    let bits_per_sample: u16 = 16;
    let byte_rate: u32 = sample_rate * channels as u32 * bits_per_sample as u32 / 8;
    let block_align: u16 = channels * bits_per_sample / 8;
    let riff_chunk_size: u32 = 36 + pcm_bytes_total;

    // RIFF header
    w.write_all(b"RIFF")?;
    w.write_all(&riff_chunk_size.to_le_bytes())?;
    w.write_all(b"WAVE")?;
    // fmt chunk
    w.write_all(b"fmt ")?;
    w.write_all(&16u32.to_le_bytes())?;       // chunk size
    w.write_all(&1u16.to_le_bytes())?;        // audio format = PCM
    w.write_all(&channels.to_le_bytes())?;
    w.write_all(&sample_rate.to_le_bytes())?;
    w.write_all(&byte_rate.to_le_bytes())?;
    w.write_all(&block_align.to_le_bytes())?;
    w.write_all(&bits_per_sample.to_le_bytes())?;
    // data chunk header
    w.write_all(b"data")?;
    w.write_all(&pcm_bytes_total.to_le_bytes())?;
    Ok(())
}

// ===== Windows-only SCSI integration =====

#[cfg(windows)]
pub use windows_impl::*;

#[cfg(windows)]
mod windows_impl {
    use super::*;
    use crate::disc::scsi_windows::{open_drive, DriveHandle};
    use std::io;

    // We want to call into the existing pass-through machinery, but those
    // helpers are private to scsi_windows. Re-implement the small subset we
    // need locally — same struct layout, same IOCTL code. This avoids touching
    // the data-disc code path while the audio-CD path stabilises.

    const IOCTL_SCSI_PASS_THROUGH_DIRECT: u32 = 0x4D014;
    const SCSI_IOCTL_DATA_IN: u8 = 1;

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
        _padding: u32,
        sense_buffer: [u8; 32],
    }

    use windows::Win32::System::IO::DeviceIoControl;

    fn passthrough(
        drive: &DriveHandle,
        cdb: &[u8],
        data_buf: &mut [u8],
        timeout_secs: u32,
    ) -> io::Result<(u8, [u8; 32])> {
        let mut req = ScsiPassThroughDirectWithBuffer {
            sptd: ScsiPassThroughDirect {
                length: std::mem::size_of::<ScsiPassThroughDirect>() as u16,
                cdb_length: cdb.len() as u8,
                sense_info_length: 32,
                data_in: SCSI_IOCTL_DATA_IN,
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
        let r = unsafe {
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
        if let Err(e) = r {
            return Err(io::Error::other(format!("DeviceIoControl: {e}")));
        }
        Ok((req.sptd.scsi_status, req.sense_buffer))
    }

    fn is_disconnect(e: &io::Error) -> bool {
        let s = e.to_string();
        s.contains("0x80070079")
            || s.contains("0x80070037")
            || s.contains("0x8007001F")
            || s.contains("0x80070015")
    }

    fn passthrough_resilient(
        drive: &DriveHandle,
        cdb: &[u8],
        data_buf: &mut [u8],
        timeout_secs: u32,
    ) -> io::Result<(u8, [u8; 32])> {
        match passthrough(drive, cdb, data_buf, timeout_secs) {
            Ok(v) => Ok(v),
            Err(e) if is_disconnect(&e) => {
                tracing::warn!("audio_cd: drive disconnect ({e}); pausing 3s and retrying");
                std::thread::sleep(std::time::Duration::from_secs(3));
                if drive.reopen().is_err() {
                    return Err(e);
                }
                passthrough(drive, cdb, data_buf, timeout_secs)
            }
            Err(e) => Err(e),
        }
    }

    /// Read the audio CD's TOC from the given drive path.
    pub fn read_toc(drive_path: &str) -> io::Result<AudioToc> {
        let drive = open_drive(drive_path)?;
        // Allocate enough for ~99 tracks × 8B + 4B header = 796.
        let mut buf = vec![0u8; 1024];
        let cdb = build_read_toc_cdb(buf.len() as u16);
        let (status, sense) = passthrough_resilient(&drive, &cdb, &mut buf, 10)?;
        if status != 0 {
            return Err(io::Error::other(format!(
                "READ TOC failed, status={status:#x} sense_key={:#x}",
                sense[2] & 0x0F
            )));
        }
        parse_toc(&buf)
    }

    /// Read a single CD-DA sector (2352 raw bytes) at the given LBA.
    /// Retries up to `retries` times on transient errors.
    pub fn read_audio_sector(
        drive_path: &str,
        lba: u32,
        retries: u8,
    ) -> io::Result<[u8; CDDA_SECTOR_BYTES]> {
        let drive = open_drive(drive_path)?;
        let cdb = build_read_cd_cdb(lba, 1);
        let mut buf = [0u8; CDDA_SECTOR_BYTES];
        let mut last_err: Option<io::Error> = None;
        for _ in 0..=retries {
            match passthrough_resilient(&drive, &cdb, &mut buf, 30) {
                Ok((0, _)) => return Ok(buf),
                Ok((status, sense)) => {
                    last_err = Some(io::Error::other(format!(
                        "READ CD lba={lba} status={status:#x} sense={:#x}",
                        sense[2] & 0x0F
                    )));
                }
                Err(e) => last_err = Some(e),
            }
        }
        Err(last_err.unwrap_or_else(|| io::Error::other("READ CD failed")))
    }

    /// Read a contiguous block of CD-DA sectors. Returns raw bytes
    /// (count * 2352). On any error, falls back to per-sector reads with
    /// zero-fill for irrecoverable sectors. The returned `bad_sectors`
    /// counts how many sectors were zero-filled.
    pub fn read_audio_block(
        drive: &DriveHandle,
        start_lba: u32,
        count: u32,
        retries: u8,
    ) -> (Vec<u8>, u32) {
        let bytes_total = (count as usize) * CDDA_SECTOR_BYTES;
        let cdb = build_read_cd_cdb(start_lba, count);
        let mut buf = vec![0u8; bytes_total];
        match passthrough_resilient(drive, &cdb, &mut buf, 60) {
            Ok((0, _)) => (buf, 0),
            _ => {
                // Fall back to per-sector reads with retry.
                let mut out = vec![0u8; bytes_total];
                let mut bad = 0u32;
                for i in 0..count {
                    let lba = start_lba + i;
                    let off = i as usize * CDDA_SECTOR_BYTES;
                    let cdb1 = build_read_cd_cdb(lba, 1);
                    let mut sbuf = [0u8; CDDA_SECTOR_BYTES];
                    let mut ok = false;
                    for _ in 0..=retries {
                        if let Ok((0, _)) = passthrough_resilient(drive, &cdb1, &mut sbuf, 30) {
                            ok = true;
                            break;
                        }
                    }
                    if ok {
                        out[off..off + CDDA_SECTOR_BYTES].copy_from_slice(&sbuf);
                    } else {
                        // Leave zeros; treat as silence for the bad sector.
                        bad += 1;
                    }
                }
                (out, bad)
            }
        }
    }

    /// Open a persistent drive handle for batch extraction (avoids re-opening
    /// the device once per sector).
    pub fn open_audio_drive(drive_path: &str) -> io::Result<DriveHandle> {
        open_drive(drive_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_header_is_44_bytes_with_riff_preamble() {
        let mut buf = Vec::new();
        write_wav_header(&mut buf, 1000).unwrap();
        assert_eq!(buf.len(), 44, "WAV header must be exactly 44 bytes");
        assert_eq!(&buf[0..4], b"RIFF");
        assert_eq!(&buf[8..12], b"WAVE");
        assert_eq!(&buf[12..16], b"fmt ");
        assert_eq!(&buf[36..40], b"data");

        // RIFF chunk size = 36 + data length
        let riff_size = u32::from_le_bytes([buf[4], buf[5], buf[6], buf[7]]);
        assert_eq!(riff_size, 36 + 1000);

        // fmt chunk size = 16
        assert_eq!(u32::from_le_bytes([buf[16], buf[17], buf[18], buf[19]]), 16);
        // PCM format tag = 1
        assert_eq!(u16::from_le_bytes([buf[20], buf[21]]), 1);
        // Stereo
        assert_eq!(u16::from_le_bytes([buf[22], buf[23]]), 2);
        // 44_100 Hz
        assert_eq!(u32::from_le_bytes([buf[24], buf[25], buf[26], buf[27]]), 44_100);
        // byte rate = 44100 * 2 * 16 / 8 = 176_400
        assert_eq!(u32::from_le_bytes([buf[28], buf[29], buf[30], buf[31]]), 176_400);
        // block align = 4
        assert_eq!(u16::from_le_bytes([buf[32], buf[33]]), 4);
        // bits per sample = 16
        assert_eq!(u16::from_le_bytes([buf[34], buf[35]]), 16);
        // data chunk size
        assert_eq!(u32::from_le_bytes([buf[40], buf[41], buf[42], buf[43]]), 1000);
    }

    #[test]
    fn parse_toc_two_tracks_plus_lead_out() {
        // Build a synthetic 2-track TOC.
        // header: data_len = 4 (header bytes) + 3 * 8 (descriptors) - 2 = 26
        // Actually: data_len excludes itself (the 2 length bytes), so:
        // data_len = 2 (first/last track bytes) + 3*8 (descriptors) = 26
        let mut buf = vec![0u8; 4 + 3 * 8];
        let data_len: u16 = 2 + 3 * 8;
        buf[0] = (data_len >> 8) as u8;
        buf[1] = (data_len & 0xFF) as u8;
        buf[2] = 1; // first track
        buf[3] = 2; // last track

        // Track 1 descriptor at offset 4: track 1, start LBA 0
        buf[4 + 1] = 0x10; // ADR/control
        buf[4 + 2] = 1;
        buf[4 + 4..4 + 8].copy_from_slice(&0u32.to_be_bytes());
        // Track 2 at offset 12: track 2, start LBA 22500 (5 min × 60 × 75)
        buf[12 + 1] = 0x10;
        buf[12 + 2] = 2;
        buf[12 + 4..12 + 8].copy_from_slice(&22_500u32.to_be_bytes());
        // Lead-out at offset 20: track 0xAA, LBA 45000 (10 min)
        buf[20 + 1] = 0x10;
        buf[20 + 2] = 0xAA;
        buf[20 + 4..20 + 8].copy_from_slice(&45_000u32.to_be_bytes());

        let toc = parse_toc(&buf).unwrap();
        assert_eq!(toc.lead_out_lba, 45_000);
        assert_eq!(toc.tracks.len(), 2);
        assert_eq!(toc.tracks[0].number, 1);
        assert_eq!(toc.tracks[0].start_lba, 0);
        assert_eq!(toc.tracks[0].end_lba, 22_500);
        assert!((toc.tracks[0].duration_secs - 300.0).abs() < 0.01);
        assert_eq!(toc.tracks[1].number, 2);
        assert_eq!(toc.tracks[1].start_lba, 22_500);
        assert_eq!(toc.tracks[1].end_lba, 45_000);
    }
}
