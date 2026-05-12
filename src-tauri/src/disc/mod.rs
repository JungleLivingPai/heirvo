//! Disc interface layer — low-level optical drive I/O.

pub mod audio_cd;
pub mod drive;
pub mod sector;

#[cfg(test)]
pub mod mock;

#[cfg(test)]
pub mod iso_file;

#[cfg(windows)]
pub mod scsi_windows;

#[cfg(windows)]
pub use scsi_windows as scsi;

pub use drive::{DriveCapabilities, DriveInfo, DiscInfo, DiscType};
pub use sector::{SectorError, SectorReadResult, SectorReader, DVD_SECTOR_SIZE, MAX_BLOCK_SECTORS};
