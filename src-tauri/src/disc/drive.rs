//! Cross-platform drive enumeration and disc identification.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DriveInfo {
    /// Win32 device path (e.g. "\\\\.\\D:") or POSIX path.
    pub path: String,
    /// Drive letter on Windows ("D:") or empty elsewhere.
    pub letter: String,
    pub vendor: String,
    pub model: String,
    pub firmware: String,
    pub capabilities: DriveCapabilities,
    /// True if the drive currently has readable media inserted. Detected via
    /// `IOCTL_STORAGE_CHECK_VERIFY` (does not spin up the drive).
    #[serde(default)]
    pub has_media: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct DriveCapabilities {
    pub reads_dvd: bool,
    pub reads_cd: bool,
    pub reads_bluray: bool,
    pub supports_speed_control: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscInfo {
    pub disc_type: DiscType,
    pub label: String,
    pub total_sectors: u64,
    pub sector_size: u32,
    /// SHA-256 of the volume descriptor (sector 16) — used as resume fingerprint.
    pub fingerprint: String,
    pub has_video_ts: bool,
    pub has_audio_ts: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiscType {
    DvdVideo,
    DvdRom,
    DvdAudio,
    Cd,
    AudioCd,
    Bluray,
    Unknown,
}

#[cfg(windows)]
pub fn list_drives() -> std::io::Result<Vec<DriveInfo>> {
    crate::disc::scsi_windows::enumerate_optical_drives()
}

#[cfg(not(windows))]
pub fn list_drives() -> std::io::Result<Vec<DriveInfo>> {
    Ok(Vec::new())
}
