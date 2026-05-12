//! Stage 1 stream-copy: turn extracted VOB files into a playable MP4 in seconds.
//!
//! The user gets a lossless, immediately viewable result without waiting for
//! a full re-encode. This runs after VOB extraction completes (or on demand
//! mid-recovery for a partial preview) and is FFmpeg's `-c copy` mode with
//! aggressive error tolerance flags so a few bad sectors in the source don't
//! abort the mux.

use crate::error::{AppError, AppResult};
use crate::media::ffmpeg;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::process::Command;

#[derive(Debug, Serialize)]
pub struct StreamCopyResult {
    pub output_path: String,
    pub bytes_written: u64,
    pub source_files: Vec<String>,
}

/// Build an FFmpeg `concat:` source string from a list of VOB files.
///
/// FFmpeg accepts `concat:VTS_01_1.VOB|VTS_01_2.VOB|...` as a single input
/// for MPEG-PS streams — exactly what DVDs are.
fn build_concat_input(vob_files: &[PathBuf]) -> String {
    let parts: Vec<String> = vob_files
        .iter()
        .map(|p| p.to_string_lossy().replace('|', "_"))
        .collect();
    format!("concat:{}", parts.join("|"))
}

/// Run an instant lossless mux on a set of VOBs. Output is MP4 with `-c copy`.
pub async fn stream_copy_vobs(
    app: &AppHandle,
    vob_files: &[PathBuf],
    output_path: &Path,
) -> AppResult<StreamCopyResult> {
    if vob_files.is_empty() {
        return Err(AppError::Media("no VOB files to mux".into()));
    }
    let bin = ffmpeg::locate_ffmpeg(app)?;
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Media(format!("create output dir: {e}")))?;
    }

    let concat_arg = build_concat_input(vob_files);
    let args: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "warning".into(),
        // Don't abort on a few bad packets — DVDs from damaged discs always have some.
        "-err_detect".into(),
        "ignore_err".into(),
        "-fflags".into(),
        "+discardcorrupt+genpts".into(),
        "-i".into(),
        concat_arg,
        // Lossless: no re-encode, just remux.
        "-c".into(),
        "copy".into(),
        "-map".into(),
        "0:v?".into(),
        "-map".into(),
        "0:a?".into(),
        // Streaming-friendly MP4 — moov atom at start so the file plays before fully written.
        "-movflags".into(),
        "+faststart".into(),
        output_path.to_string_lossy().to_string(),
    ];

    tracing::info!("stream_copy ffmpeg {}", args.join(" "));

    let output = Command::new(&bin)
        .args(&args)
        .output()
        .await
        .map_err(|e| AppError::Media(format!("spawn ffmpeg: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Media(format!(
            "stream-copy failed (exit {}): {}",
            output.status.code().unwrap_or(-1),
            stderr.lines().last().unwrap_or("(no stderr)")
        )));
    }

    let bytes_written = std::fs::metadata(output_path).map(|m| m.len()).unwrap_or(0);

    Ok(StreamCopyResult {
        output_path: output_path.to_string_lossy().to_string(),
        bytes_written,
        source_files: vob_files
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect(),
    })
}
