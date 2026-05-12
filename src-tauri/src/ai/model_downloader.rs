//! Streamed AI model downloader with SHA-256 verification + progress events.
//!
//! Mirrors the FFmpeg downloader pattern from `media/ffmpeg_install.rs`:
//! - Streams the file (no whole-file-in-memory)
//! - Emits `model:download_progress` events ~5x/sec so the UI can render a bar
//! - Verifies SHA-256 if the catalog pins one — corrupt downloads never claim
//!   to be installed
//! - Idempotent: skip if file already present at the target path

use crate::ai::models::{model_path, AiModel};
use crate::error::{AppError, AppResult};
use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStage {
    Starting,
    Downloading,
    Verifying,
    Installed,
    Failed,
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub model_id: String,
    pub stage: DownloadStage,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct DownloadResult {
    pub model_id: String,
    pub path: String,
    pub bytes: u64,
    pub verified: bool,
}

pub async fn download_model(app: AppHandle, model: AiModel) -> AppResult<DownloadResult> {
    let url = model
        .download_url()
        .ok_or_else(|| AppError::Ai(format!(
            "No download URL configured for {}. Drop the ONNX file at the model directory manually.",
            model.id()
        )))?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    let target = model_path(&data_dir, model);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Idempotent skip — but also re-verify if the catalog pins a hash.
    if target.is_file() {
        if let Some(expected) = model.expected_sha256() {
            let actual = sha256_file(&target)?;
            if actual.eq_ignore_ascii_case(expected) {
                let bytes = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
                return Ok(DownloadResult {
                    model_id: model.id().to_string(),
                    path: target.to_string_lossy().to_string(),
                    bytes,
                    verified: true,
                });
            }
            // Hash mismatch: file is corrupt/old. Remove and re-download.
            tracing::warn!(
                "Existing {} at {} has wrong hash; redownloading",
                model.id(),
                target.display()
            );
            std::fs::remove_file(&target)?;
        } else {
            let bytes = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
            return Ok(DownloadResult {
                model_id: model.id().to_string(),
                path: target.to_string_lossy().to_string(),
                bytes,
                verified: false,
            });
        }
    }

    let emit = Arc::new({
        let app = app.clone();
        let id = model.id().to_string();
        move |p: DownloadProgress| {
            let _ = app.emit("model:download_progress", &p);
            let _ = id;
        }
    });

    emit(DownloadProgress {
        model_id: model.id().into(),
        stage: DownloadStage::Starting,
        bytes_done: 0,
        bytes_total: 0,
        message: format!("Connecting for {}…", model.id()),
    });

    let client = reqwest::Client::builder()
        .user_agent("dvd-recovery/0.1")
        .build()
        .map_err(|e| AppError::Internal(format!("reqwest builder: {e}")))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Ai(format!("download {}: {e}", model.id())))?
        .error_for_status()
        .map_err(|e| AppError::Ai(format!("download {}: {e}", model.id())))?;

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut hasher = Sha256::new();

    // Write to a `.partial` file so we never expose a half-baked path.
    let partial_path = target.with_extension("onnx.partial");
    let mut file = std::fs::File::create(&partial_path)?;

    let mut stream = resp.bytes_stream();
    let mut next_emit = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| AppError::Ai(format!("download chunk: {e}")))?;
        file.write_all(&chunk)?;
        if model.expected_sha256().is_some() {
            hasher.update(&chunk);
        }
        downloaded += chunk.len() as u64;

        if next_emit.elapsed() >= std::time::Duration::from_millis(200) {
            emit(DownloadProgress {
                model_id: model.id().into(),
                stage: DownloadStage::Downloading,
                bytes_done: downloaded,
                bytes_total: total,
                message: format!(
                    "Downloading {} ({:.1} / {:.1} MB)",
                    model.id(),
                    downloaded as f64 / 1024.0 / 1024.0,
                    total as f64 / 1024.0 / 1024.0,
                ),
            });
            next_emit = std::time::Instant::now();
        }
    }
    file.sync_all()?;
    drop(file);

    if let Some(expected) = model.expected_sha256() {
        emit(DownloadProgress {
            model_id: model.id().into(),
            stage: DownloadStage::Verifying,
            bytes_done: downloaded,
            bytes_total: total,
            message: "Verifying SHA-256…".into(),
        });
        let actual = format!("{:x}", hasher.finalize());
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = std::fs::remove_file(&partial_path);
            let msg = format!(
                "Hash mismatch for {}: expected {expected}, got {actual}",
                model.id()
            );
            emit(DownloadProgress {
                model_id: model.id().into(),
                stage: DownloadStage::Failed,
                bytes_done: downloaded,
                bytes_total: total,
                message: msg.clone(),
            });
            return Err(AppError::Ai(msg));
        }
    }

    std::fs::rename(&partial_path, &target)?;

    emit(DownloadProgress {
        model_id: model.id().into(),
        stage: DownloadStage::Installed,
        bytes_done: downloaded,
        bytes_total: total,
        message: format!("Installed at {}", target.display()),
    });

    Ok(DownloadResult {
        model_id: model.id().to_string(),
        path: target.to_string_lossy().to_string(),
        bytes: downloaded,
        verified: model.expected_sha256().is_some(),
    })
}

/// SHA-256 a file by streaming (no whole-file-in-memory).
fn sha256_file(path: &PathBuf) -> AppResult<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_file_matches_known_input() {
        let tmp = std::env::temp_dir().join(format!(
            "dvd-rescue-sha-{}.bin",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::write(&tmp, b"hello").unwrap();
        // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        let h = sha256_file(&tmp).unwrap();
        assert_eq!(
            h,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
        let _ = std::fs::remove_file(&tmp);
    }
}
