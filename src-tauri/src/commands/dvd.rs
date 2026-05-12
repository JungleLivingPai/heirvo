//! DVD structure analysis commands.

use crate::dvd::iso9660::IsoEntry;
use crate::error::{AppError, AppResult};
use crate::session::manager;
use crate::state::AppState;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct StructureSummary {
    pub volume_label: String,
    pub video_ts_files: Vec<IsoEntry>,
}

#[tauri::command]
pub async fn analyze_structure(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<StructureSummary> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;

    let drive_path = session.drive_path.clone();
    let result = tokio::task::spawn_blocking(move || -> AppResult<StructureSummary> {
        #[cfg(windows)]
        {
            use crate::disc::scsi_windows::ScsiSectorReader;
            let reader = ScsiSectorReader::open(&drive_path)
                .map_err(|e| AppError::Drive(format!("open: {e}")))?;
            let vol = crate::dvd::iso9660::read_volume(&reader)
                .map_err(|e| AppError::DvdStructure(format!("read_volume: {e}")))?;
            let files = crate::dvd::iso9660::list_video_ts(&reader)
                .map_err(|e| AppError::DvdStructure(format!("list_video_ts: {e}")))?
                .unwrap_or_default();
            Ok(StructureSummary { volume_label: vol.label, video_ts_files: files })
        }
        #[cfg(not(windows))]
        {
            let _ = drive_path;
            Err(AppError::NotImplemented("analyze_structure (non-Windows)"))
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))??;

    Ok(result)
}

#[tauri::command]
pub async fn extract_vobs(
    state: State<'_, AppState>,
    session_id: String,
    file_names: Vec<String>,
) -> AppResult<Vec<crate::media::vob::ExtractedFile>> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;
    let map = manager::load_sector_map(&state.db, id).await?;

    let drive_path = session.drive_path.clone();
    let output_dir = std::path::PathBuf::from(&session.output_dir).join("VIDEO_TS");

    let extracted = tokio::task::spawn_blocking(move || -> AppResult<_> {
        #[cfg(windows)]
        {
            use crate::disc::scsi_windows::ScsiSectorReader;
            let reader = ScsiSectorReader::open(&drive_path)
                .map_err(|e| AppError::Drive(format!("open: {e}")))?;
            let all = crate::dvd::iso9660::list_video_ts(&reader)
                .map_err(|e| AppError::DvdStructure(format!("list_video_ts: {e}")))?
                .ok_or_else(|| AppError::DvdStructure("no VIDEO_TS folder".into()))?;
            let selected: Vec<_> = if file_names.is_empty() {
                all
            } else {
                all.into_iter().filter(|e| file_names.iter().any(|n| n.eq_ignore_ascii_case(&e.name))).collect()
            };
            crate::media::vob::extract_files(&reader, map.as_ref(), &selected, &output_dir)
                .map_err(|e| AppError::Media(format!("extract_files: {e}")))
        }
        #[cfg(not(windows))]
        {
            let _ = (drive_path, output_dir, file_names, map);
            Err(AppError::NotImplemented("extract_vobs (non-Windows)"))
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))??;

    Ok(extracted)
}

/// Extract every file from a data disc (CD-R photo backup, document
/// archive, etc.) — recurses the full ISO 9660 tree, not just VIDEO_TS.
/// Damaged sectors are zero-filled so callers always get the file at its
/// real on-disc length, even from a wrecked disc.
#[tauri::command]
pub async fn extract_all_files(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<Vec<crate::media::vob::ExtractedFile>> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;
    let map = manager::load_sector_map(&state.db, id).await?;

    let drive_path = session.drive_path.clone();
    let output_dir = std::path::PathBuf::from(&session.output_dir).join("Recovered Files");

    let extracted = tokio::task::spawn_blocking(move || -> AppResult<_> {
        #[cfg(windows)]
        {
            use crate::disc::scsi_windows::ScsiSectorReader;
            let reader = ScsiSectorReader::open(&drive_path)
                .map_err(|e| AppError::Drive(format!("open: {e}")))?;
            let all = crate::dvd::iso9660::walk_all_files(&reader)
                .map_err(|e| AppError::DvdStructure(format!("walk_all_files: {e}")))?;
            crate::media::vob::extract_files(&reader, map.as_ref(), &all, &output_dir)
                .map_err(|e| AppError::Media(format!("extract_files: {e}")))
        }
        #[cfg(not(windows))]
        {
            let _ = (drive_path, output_dir, map);
            Err(AppError::NotImplemented("extract_all_files (non-Windows)"))
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))??;

    Ok(extracted)
}

#[tauri::command]
pub async fn health_score(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<crate::recovery::health::HealthReport> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let map = manager::load_sector_map(&state.db, id)
        .await?
        .ok_or_else(|| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;

    let drive_path = session.drive_path.clone();
    let video_ts = tokio::task::spawn_blocking(move || -> Option<Vec<IsoEntry>> {
        #[cfg(windows)]
        {
            use crate::disc::scsi_windows::ScsiSectorReader;
            ScsiSectorReader::open(&drive_path)
                .ok()
                .and_then(|r| crate::dvd::iso9660::list_video_ts(&r).ok().flatten())
        }
        #[cfg(not(windows))]
        {
            let _ = drive_path;
            None
        }
    })
    .await
    .ok()
    .flatten();

    Ok(crate::recovery::health::compute(&map, video_ts.as_deref()))
}
