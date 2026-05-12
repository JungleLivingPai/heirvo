//! Sector-level abstractions. The `SectorReader` trait decouples the recovery
//! engine from the underlying I/O backend (real drive, ISO file, mock for tests).

use serde::{Deserialize, Serialize};

pub const DVD_SECTOR_SIZE: usize = 2048;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SectorError {
    /// Physical/medium error — the most common failure on damaged DVDs.
    MediumError,
    /// Drive hardware fault (transient, often cleared by reset).
    HardwareError,
    /// Bad LBA — past end of disc, or sector address invalid.
    IllegalRequest,
    /// Read timed out (drive stuck retrying).
    Timeout,
    /// Drive reports uncorrectable ECC error.
    Uncorrectable,
    /// Generic / unknown error from underlying I/O.
    Other,
}

#[derive(Debug, Clone)]
pub struct SectorReadResult {
    pub lba: u64,
    pub data: Option<Vec<u8>>,
    pub error: Option<SectorError>,
    pub retry_count: u8,
    pub read_time_ms: u32,
}

impl SectorReadResult {
    pub fn ok(lba: u64, data: Vec<u8>, read_time_ms: u32) -> Self {
        Self { lba, data: Some(data), error: None, retry_count: 0, read_time_ms }
    }

    pub fn err(lba: u64, error: SectorError, retry_count: u8, read_time_ms: u32) -> Self {
        Self { lba, data: None, error: Some(error), retry_count, read_time_ms }
    }

    pub fn is_ok(&self) -> bool {
        self.data.is_some()
    }
}

/// Read strategy hint passed down from the recovery engine.
#[derive(Debug, Clone, Copy)]
pub struct ReadOptions {
    /// Number of internal retries (drive-level + driver-level) before giving up.
    pub retries: u8,
    /// Force the drive to a slower read speed if supported (reduces vibration on damaged media).
    pub slow_mode: bool,
    /// Soft timeout per sector read attempt.
    pub timeout_ms: u32,
}

impl Default for ReadOptions {
    fn default() -> Self {
        Self { retries: 1, slow_mode: false, timeout_ms: 30_000 }
    }
}

/// Maximum sectors per multi-sector block read. 32 × 2048 = 64KB — within the
/// per-IOCTL transfer ceiling of every consumer-grade Windows optical driver
/// (USB external drives often cap at 64KB; 128KB returns ERROR_INVALID_PARAMETER).
pub const MAX_BLOCK_SECTORS: u32 = 32;

/// Abstract sector-reading backend. Implemented by:
/// - `scsi_windows::ScsiSectorReader` — real DVD drive on Windows
/// - Future: `IsoSectorReader` for resuming from a partial ISO
/// - Future: `MockSectorReader` for testing
pub trait SectorReader: Send + Sync {
    /// Read a single 2048-byte sector. Must be safe to call from any thread.
    fn read_sector(&self, lba: u64, opts: ReadOptions) -> SectorReadResult;

    /// Read a contiguous block of sectors in one IOCTL roundtrip.
    ///
    /// The default implementation walks the block one sector at a time — backends
    /// should override with a single multi-sector READ(10) for ~10-50x throughput
    /// on healthy media. On any per-block error, they should fall back to single
    /// reads to pinpoint exactly which LBAs are bad.
    fn read_block(&self, start_lba: u64, count: u32, opts: ReadOptions) -> Vec<SectorReadResult> {
        (0..count as u64)
            .map(|i| self.read_sector(start_lba + i, opts))
            .collect()
    }

    /// Total addressable sectors on the disc (read capacity).
    fn capacity(&self) -> u64;

    /// Sector size in bytes (almost always 2048 for DVD).
    fn sector_size(&self) -> u32 {
        DVD_SECTOR_SIZE as u32
    }

    /// Optional: reset the drive (used between aggressive retry passes).
    fn reset(&self) -> std::io::Result<()> {
        Ok(())
    }
}
