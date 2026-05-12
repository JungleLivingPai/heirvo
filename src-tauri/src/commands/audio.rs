//! IPC commands for audio CD ripping.

use crate::error::{AppError, AppResult};
use crate::session::manager;
use crate::state::AppState;
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct ExtractedAudioFile {
    pub track_number: u8,
    pub file_path: String,
    pub size_bytes: u64,
    pub duration_secs: f32,
    pub bad_sectors: u32,
}

#[tauri::command]
pub async fn read_audio_toc(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<crate::disc::audio_cd::AudioToc> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;
    let drive_path = session.drive_path.clone();

    tokio::task::spawn_blocking(move || -> AppResult<_> {
        #[cfg(windows)]
        {
            crate::disc::audio_cd::read_toc(&drive_path)
                .map_err(|e| AppError::Drive(format!("read_toc: {e}")))
        }
        #[cfg(not(windows))]
        {
            let _ = drive_path;
            Err(AppError::NotImplemented("read_audio_toc (non-Windows)"))
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))?
}

#[tauri::command]
pub async fn extract_audio_tracks(
    state: State<'_, AppState>,
    session_id: String,
    output_dir: Option<String>,
) -> AppResult<Vec<ExtractedAudioFile>> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;
    let drive_path = session.drive_path.clone();
    let out_dir = PathBuf::from(output_dir.unwrap_or(session.output_dir.clone()));

    tokio::task::spawn_blocking(move || -> AppResult<Vec<ExtractedAudioFile>> {
        #[cfg(windows)]
        {
            use crate::disc::audio_cd::{
                open_audio_drive, read_audio_block, read_toc, write_wav_header,
                CDDA_SECTOR_BYTES,
            };
            use std::fs::File;
            use std::io::{BufWriter, Write};

            std::fs::create_dir_all(&out_dir)
                .map_err(|e| AppError::Io(e))?;

            let toc = read_toc(&drive_path)
                .map_err(|e| AppError::Drive(format!("read_toc: {e}")))?;
            let drive = open_audio_drive(&drive_path)
                .map_err(|e| AppError::Drive(format!("open: {e}")))?;

            let mut results = Vec::with_capacity(toc.tracks.len());
            // Read in modest chunks — 27 sectors = ~64 KB, matches the data
            // path's transfer ceiling and keeps the brownout risk low.
            const CHUNK: u32 = 27;

            for track in &toc.tracks {
                let sectors = track.end_lba.saturating_sub(track.start_lba);
                if sectors == 0 {
                    continue;
                }
                let pcm_bytes = sectors as u64 * CDDA_SECTOR_BYTES as u64;
                let pcm_bytes_u32 = u32::try_from(pcm_bytes).unwrap_or(u32::MAX);
                let file_name = format!("Track {:02}.wav", track.number);
                let path = out_dir.join(&file_name);
                let f = File::create(&path).map_err(AppError::Io)?;
                let mut w = BufWriter::new(f);
                write_wav_header(&mut w, pcm_bytes_u32).map_err(AppError::Io)?;

                let mut bad_total: u32 = 0;
                let mut lba = track.start_lba;
                while lba < track.end_lba {
                    let n = std::cmp::min(CHUNK, track.end_lba - lba);
                    let (data, bad) = read_audio_block(&drive, lba, n, 2);
                    bad_total += bad;
                    w.write_all(&data).map_err(AppError::Io)?;
                    lba += n;
                }
                w.flush().map_err(AppError::Io)?;

                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                results.push(ExtractedAudioFile {
                    track_number: track.number,
                    file_path: path.to_string_lossy().into_owned(),
                    size_bytes: size,
                    duration_secs: track.duration_secs,
                    bad_sectors: bad_total,
                });
            }

            Ok(results)
        }
        #[cfg(not(windows))]
        {
            let _ = (drive_path, out_dir);
            Err(AppError::NotImplemented("extract_audio_tracks (non-Windows)"))
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))?
}
