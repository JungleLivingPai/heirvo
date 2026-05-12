//! Drive enumeration and disc identification commands.

use crate::disc::drive::{DiscInfo, DiscType, DriveInfo};
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn list_drives() -> AppResult<Vec<DriveInfo>> {
    tokio::task::spawn_blocking(crate::disc::drive::list_drives)
        .await
        .map_err(|e| AppError::Internal(format!("join: {e}")))?
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn check_disc(drive_path: String) -> AppResult<Option<DiscInfo>> {
    tokio::task::spawn_blocking(move || -> AppResult<Option<DiscInfo>> {
        #[cfg(windows)]
        {
            use crate::disc::scsi_windows::ScsiSectorReader;
            use crate::disc::sector::{ReadOptions, SectorReader};

            let reader = match ScsiSectorReader::open(&drive_path) {
                Ok(r) => r,
                Err(e) => {
                    tracing::warn!("Failed to open drive {drive_path}: {e}");
                    return Ok(None);
                }
            };

            // Read sector 16 = ISO 9660 primary volume descriptor.
            let result = reader.read_sector(16, ReadOptions::default());
            let total_capacity = reader.capacity();
            let has_iso_pvd = result
                .data
                .as_ref()
                .map(|d| d.len() >= 6 && &d[1..6] == b"CD001")
                .unwrap_or(false);

            // Audio CD detection: no ISO 9660 filesystem AND CD-sized capacity.
            // We attempt a READ TOC; if it succeeds with at least one track,
            // we treat the disc as a CD-DA. (READ TOC is also valid on data
            // CDs, but those are caught by the ISO PVD check above.)
            if !has_iso_pvd && total_capacity > 0 && total_capacity < 600_000 {
                if let Ok(toc) = crate::disc::audio_cd::read_toc(&drive_path) {
                    if !toc.tracks.is_empty() {
                        let last_end = toc.tracks.last().map(|t| t.end_lba as u64)
                            .unwrap_or(toc.lead_out_lba as u64);
                        return Ok(Some(DiscInfo {
                            disc_type: DiscType::AudioCd,
                            label: "Audio CD".into(),
                            total_sectors: last_end,
                            sector_size: crate::disc::audio_cd::CDDA_SECTOR_BYTES as u32,
                            fingerprint: format!(
                                "audio-cd:{}-{}",
                                toc.tracks.len(),
                                last_end
                            ),
                            has_video_ts: false,
                            has_audio_ts: false,
                        }));
                    }
                }
            }

            let Some(data) = result.data else {
                return Ok(Some(DiscInfo {
                    disc_type: DiscType::Unknown,
                    label: "(unreadable)".into(),
                    total_sectors: reader.capacity(),
                    sector_size: reader.sector_size(),
                    fingerprint: String::new(),
                    has_video_ts: false,
                    has_audio_ts: false,
                }));
            };

            // ISO 9660 PVD: bytes [40..72] = volume identifier, padded with spaces.
            let label = if data.len() >= 72 && data[1..6] == *b"CD001" {
                String::from_utf8_lossy(&data[40..72]).trim().to_string()
            } else {
                "(unknown filesystem)".into()
            };

            let fingerprint = crate::session::manager::fingerprint_disc(&data, reader.capacity());
            let total = reader.capacity();

            // Walk the root directory to detect VIDEO_TS / AUDIO_TS folders.
            let (has_video_ts, has_audio_ts) =
                match crate::dvd::iso9660::read_volume(&reader) {
                    Ok(vol) => match crate::dvd::iso9660::read_directory(
                        &reader, vol.root_lba, vol.root_size, "/",
                    ) {
                        Ok(root) => {
                            let video = root.entries.iter().any(|e| {
                                e.is_dir && e.name.eq_ignore_ascii_case("VIDEO_TS")
                            });
                            let audio = root.entries.iter().any(|e| {
                                e.is_dir && e.name.eq_ignore_ascii_case("AUDIO_TS")
                            });
                            (video, audio)
                        }
                        Err(_) => (false, false),
                    },
                    Err(_) => (false, false),
                };

            let disc_type = if has_video_ts {
                DiscType::DvdVideo
            } else if has_audio_ts {
                DiscType::DvdAudio
            } else if total > 600_000 {
                DiscType::DvdRom
            } else {
                DiscType::Cd
            };

            Ok(Some(DiscInfo {
                disc_type,
                label,
                total_sectors: total,
                sector_size: reader.sector_size(),
                fingerprint,
                has_video_ts,
                has_audio_ts,
            }))
        }
        #[cfg(not(windows))]
        {
            let _ = drive_path;
            Ok(None)
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))?
}
