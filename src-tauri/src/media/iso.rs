//! ISO image assembly from a recovery session's sector data.
//!
//! Streams raw 2048-byte sectors from the disc to a target .iso file:
//!   - Sectors marked Good are read fresh and written.
//!   - Sectors marked Failed/Skipped/Unknown are written as zero-filled blocks.
//!
//! The resulting file is exactly `total_sectors * 2048` bytes, so absolute
//! sector offsets in the original disc match offsets in the ISO. This lets
//! downstream tools (FFmpeg, libdvdread) mount it as a virtual disc.

use crate::disc::sector::{ReadOptions, SectorReader, DVD_SECTOR_SIZE};
use crate::recovery::map::{SectorMap, SectorState};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Progress callback: (current_lba, total_lbas, good, failed).
pub type ProgressFn = Arc<dyn Fn(u64, u64, u64, u64) + Send + Sync>;

pub struct AssembleStats {
    pub bytes_written: u64,
    pub good_sectors: u64,
    pub zero_filled_sectors: u64,
}

/// Assemble an ISO from a connected sector reader plus a known sector map.
///
/// Re-reads Good sectors fresh from the disc rather than caching them in
/// memory — for a single-layer DVD this still streams at the drive's sequential
/// read speed (~10 MB/s on damaged discs, faster on clean media).
pub fn assemble_iso(
    reader: &dyn SectorReader,
    map: &SectorMap,
    output_path: &Path,
    progress: Option<ProgressFn>,
    cancel: Option<Arc<std::sync::atomic::AtomicBool>>,
) -> std::io::Result<AssembleStats> {
    let total = map.total();
    if total != reader.capacity() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!(
                "sector map size {} does not match drive capacity {}",
                total,
                reader.capacity()
            ),
        ));
    }

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = File::create(output_path)?;
    let mut writer = BufWriter::with_capacity(1024 * 1024, file);

    let zero_block = [0u8; DVD_SECTOR_SIZE];
    let good_count = AtomicU64::new(0);
    let zero_count = AtomicU64::new(0);

    let report_every = (total / 200).max(100);
    let opts = ReadOptions { retries: 1, slow_mode: false, timeout_ms: 15_000 };

    for lba in 0..total {
        if let Some(c) = &cancel {
            if c.load(Ordering::SeqCst) {
                writer.flush()?;
                break;
            }
        }
        match map.get(lba) {
            SectorState::Good => {
                let res = reader.read_sector(lba, opts);
                match res.data {
                    Some(d) => {
                        writer.write_all(&d)?;
                        good_count.fetch_add(1, Ordering::Relaxed);
                    }
                    None => {
                        // Map said Good but read failed now — write zeros and
                        // mark as zero-filled in the report. Caller may want
                        // to re-run a recovery pass.
                        writer.write_all(&zero_block)?;
                        zero_count.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            _ => {
                writer.write_all(&zero_block)?;
                zero_count.fetch_add(1, Ordering::Relaxed);
            }
        }
        if lba % report_every == 0 {
            if let Some(p) = &progress {
                p(
                    lba,
                    total,
                    good_count.load(Ordering::Relaxed),
                    zero_count.load(Ordering::Relaxed),
                );
            }
        }
    }

    writer.flush()?;
    drop(writer);

    Ok(AssembleStats {
        bytes_written: total * DVD_SECTOR_SIZE as u64,
        good_sectors: good_count.load(Ordering::Relaxed),
        zero_filled_sectors: zero_count.load(Ordering::Relaxed),
    })
}
