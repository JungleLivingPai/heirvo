//! Media output commands (ISO assembly, FFmpeg transcoding, ffmpeg detection).

use crate::error::{AppError, AppResult};
use crate::media::ffmpeg::{self, FfmpegProgress, ProbeResult};
use crate::media::transcode::TranscodeJob;
use crate::session::manager;
use crate::state::AppState;
use chrono::Utc;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::watch;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct IsoResult {
    pub path: String,
    pub bytes_written: u64,
    pub good_sectors: u64,
    pub zero_filled_sectors: u64,
}

#[tauri::command]
pub async fn create_iso(
    state: State<'_, AppState>,
    session_id: String,
    output_path: Option<String>,
) -> AppResult<IsoResult> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;
    let map = manager::load_sector_map(&state.db, id)
        .await?
        .ok_or_else(|| AppError::SessionNotFound(session_id.clone()))?;

    let target = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let safe_label = session
                .disc_label
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
                .collect::<String>();
            let name = if safe_label.is_empty() { "recovered".into() } else { safe_label };
            PathBuf::from(&session.output_dir).join(format!("{name}.iso"))
        }
    };

    let drive_path = session.drive_path.clone();
    let target_for_task = target.clone();
    let stats = tokio::task::spawn_blocking(move || -> AppResult<crate::media::iso::AssembleStats> {
        #[cfg(windows)]
        {
            use crate::disc::scsi_windows::ScsiSectorReader;
            let reader = ScsiSectorReader::open(&drive_path)
                .map_err(|e| AppError::Drive(format!("open: {e}")))?;
            crate::media::iso::assemble_iso(&reader, &map, &target_for_task, None, None)
                .map_err(|e| AppError::Media(format!("assemble_iso: {e}")))
        }
        #[cfg(not(windows))]
        {
            let _ = (drive_path, target_for_task, map);
            Err(AppError::NotImplemented("create_iso (non-Windows)"))
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))??;

    let now = Utc::now().timestamp();
    let path_str = target.to_string_lossy().to_string();
    sqlx::query(
        "INSERT INTO output_files (session_id, file_type, path, size_bytes, status, created_at)
         VALUES (?, 'iso', ?, ?, 'complete', ?)",
    )
    .bind(id.to_string())
    .bind(&path_str)
    .bind(stats.bytes_written as i64)
    .bind(now)
    .execute(&state.db.pool)
    .await?;

    Ok(IsoResult {
        path: path_str,
        bytes_written: stats.bytes_written,
        good_sectors: stats.good_sectors,
        zero_filled_sectors: stats.zero_filled_sectors,
    })
}

#[derive(Debug, Serialize)]
pub struct FfmpegStatus {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[tauri::command]
pub async fn ffmpeg_status(app: AppHandle) -> AppResult<FfmpegStatus> {
    match ffmpeg::locate(&app, if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" }) {
        Some(path) => {
            // Capture `ffmpeg -version` first line.
            let output = tokio::process::Command::new(&path)
                .arg("-version")
                .output()
                .await
                .ok();
            let version = output.and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .next()
                    .map(|l| l.to_string())
            });
            Ok(FfmpegStatus {
                available: true,
                path: Some(path.to_string_lossy().to_string()),
                version,
            })
        }
        None => Ok(FfmpegStatus { available: false, path: None, version: None }),
    }
}

#[tauri::command]
pub async fn ffprobe_file(app: AppHandle, path: String) -> AppResult<ProbeResult> {
    let bin = ffmpeg::locate_ffprobe(&app)?;
    ffmpeg::probe(&bin, std::path::Path::new(&path)).await
}

#[tauri::command]
pub async fn install_ffmpeg(app: AppHandle) -> AppResult<String> {
    crate::media::ffmpeg_install::install(app).await
}

/// Stage 1: instant lossless MP4 from a session's extracted VOBs.
/// Auto-extracts VOBs first if they're not on disk yet.
#[tauri::command]
pub async fn save_as_mp4(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<crate::media::stream_copy::StreamCopyResult> {
    use std::path::PathBuf;
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;

    // Make sure VOBs have been extracted to disk.
    let vob_dir = PathBuf::from(&session.output_dir).join("VIDEO_TS");
    let need_extract = !vob_dir.exists()
        || std::fs::read_dir(&vob_dir)
            .map(|d| d.filter_map(|e| e.ok()).count() == 0)
            .unwrap_or(true);

    if need_extract {
        tracing::info!("save_as_mp4: VOBs not present, extracting");
        let drive_path = session.drive_path.clone();
        let map = manager::load_sector_map(&state.db, id).await?;
        let vob_dir_clone = vob_dir.clone();
        tokio::task::spawn_blocking(move || -> AppResult<()> {
            #[cfg(windows)]
            {
                use crate::disc::scsi_windows::ScsiSectorReader;
                let reader = ScsiSectorReader::open(&drive_path)
                    .map_err(|e| AppError::Drive(format!("open: {e}")))?;
                let all = crate::dvd::iso9660::list_video_ts(&reader)
                    .map_err(|e| AppError::DvdStructure(format!("list_video_ts: {e}")))?
                    .ok_or_else(|| AppError::DvdStructure("no VIDEO_TS folder".into()))?;
                crate::media::vob::extract_files(&reader, map.as_ref(), &all, &vob_dir_clone)
                    .map_err(|e| AppError::Media(format!("extract_files: {e}")))?;
                Ok(())
            }
            #[cfg(not(windows))]
            {
                let _ = (drive_path, vob_dir_clone, map);
                Err(AppError::NotImplemented("save_as_mp4 (non-Windows)"))
            }
        })
        .await
        .map_err(|e| AppError::Internal(format!("join: {e}")))??;
    }

    // Collect VOB files in title order: VTS_01_1.VOB, VTS_01_2.VOB, …
    let mut vobs: Vec<PathBuf> = std::fs::read_dir(&vob_dir)
        .map_err(|e| AppError::Media(format!("read VIDEO_TS dir: {e}")))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|x| x.to_str())
                .map(|s| s.eq_ignore_ascii_case("VOB"))
                .unwrap_or(false)
        })
        // Skip the menu VOB (VTS_NN_0.VOB) — we want title content only.
        .filter(|p| {
            !p.file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_ascii_uppercase().ends_with("_0.VOB"))
                .unwrap_or(false)
        })
        .collect();
    vobs.sort();

    if vobs.is_empty() {
        return Err(AppError::Media("no playable VOBs found".into()));
    }

    // Output path: <output_dir>/<safe_label>.mp4
    let safe_label: String = session
        .disc_label
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let stem = if safe_label.is_empty() { "recovered".into() } else { safe_label };
    let output = PathBuf::from(&session.output_dir).join(format!("{stem}.mp4"));

    let result = crate::media::stream_copy::stream_copy_vobs(&app, &vobs, &output).await?;

    // Record output file in DB.
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO output_files (session_id, file_type, path, size_bytes, status, created_at)
         VALUES (?, 'mp4', ?, ?, 'complete', ?)",
    )
    .bind(id.to_string())
    .bind(&result.output_path)
    .bind(result.bytes_written as i64)
    .bind(now)
    .execute(&state.db.pool)
    .await?;

    Ok(result)
}

#[derive(Debug, Serialize, Clone)]
pub struct TranscodeStarted {
    pub job_id: String,
}

/// Start a transcode job. Progress events are emitted as `transcode:progress`
/// with payload `{ jobId, frame, fps, bitrate_kbps, out_time_us, speed }`.
/// Completion fires `transcode:complete` or `transcode:error`.
#[tauri::command]
pub async fn transcode(app: AppHandle, job: TranscodeJob) -> AppResult<TranscodeStarted> {
    let job_id = Uuid::new_v4().to_string();
    let job_id_clone = job_id.clone();
    let app_for_task = app.clone();

    let on_progress: Arc<dyn Fn(FfmpegProgress) + Send + Sync> = {
        let app = app.clone();
        let job_id = job_id.clone();
        Arc::new(move |p| {
            #[derive(Serialize, Clone)]
            struct Payload {
                job_id: String,
                #[serde(flatten)]
                progress: FfmpegProgress,
            }
            let _ = app.emit(
                "transcode:progress",
                Payload { job_id: job_id.clone(), progress: p },
            );
        })
    };

    // We don't currently expose cancel via this command — could plumb a watch
    // channel into a registry if/when we add a cancel button.
    let (_cancel_tx, cancel_rx) = watch::channel(false);

    tokio::spawn(async move {
        let result = crate::media::transcode::run(&app_for_task, job, on_progress, Some(cancel_rx)).await;
        match result {
            Ok(()) => {
                let _ = app_for_task.emit("transcode:complete", &job_id_clone);
            }
            Err(e) => {
                let _ = app_for_task.emit(
                    "transcode:error",
                    &serde_json::json!({ "job_id": job_id_clone, "error": e.to_string() }),
                );
            }
        }
    });

    Ok(TranscodeStarted { job_id })
}
