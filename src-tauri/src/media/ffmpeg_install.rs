//! FFmpeg auto-downloader.
//!
//! Fetches the Gyan D "essentials" build (LGPL, no GPL components, ~80MB zip)
//! and extracts `ffmpeg.exe` + `ffprobe.exe` into `<app_data>/ffmpeg/`.
//!
//! Source: GitHub Releases mirror of https://www.gyan.dev/ffmpeg/builds/ —
//! same binary, served from GitHub CDN for better reliability.
//! Falls back to the direct gyan.dev URL if the primary fails.

use crate::error::{AppError, AppResult};
use futures_util::StreamExt;
use serde::Serialize;
use std::io::{Cursor, Read, Write};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

/// Primary: direct gyan.dev URL (stable filename across versions).
const FFMPEG_DOWNLOAD_URL: &str =
    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

/// Fallback: GitHub Releases API — find the latest *essentials_build.zip asset.
/// (Asset filename embeds the version, e.g. `ffmpeg-8.1.1-essentials_build.zip`,
/// so we can't hardcode it; we resolve it dynamically.)
const FFMPEG_GH_API_LATEST: &str =
    "https://api.github.com/repos/GyanD/codexffmpeg/releases/latest";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum InstallStage {
    Starting,
    Downloading,
    Extracting,
    Installed,
    Failed,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallProgress {
    pub stage: InstallStage,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub message: String,
}

pub async fn install(app: AppHandle) -> AppResult<String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    let target_dir = data_dir.join("ffmpeg");
    std::fs::create_dir_all(&target_dir)?;

    let emit = Arc::new({
        let app = app.clone();
        move |p: InstallProgress| {
            let _ = app.emit("ffmpeg:install_progress", &p);
        }
    });

    emit(InstallProgress {
        stage: InstallStage::Starting,
        bytes_done: 0,
        bytes_total: 0,
        message: "Connecting…".into(),
    });

    let client = reqwest::Client::builder()
        .user_agent("heirvo/0.1")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("reqwest builder: {e}")))?;

    // Try primary URL (gyan.dev — stable filename). Fall back on BOTH transport
    // errors AND HTTP error status (404, 503, etc.) by resolving the real GitHub
    // asset URL via the API.
    let try_primary = async {
        client
            .get(FFMPEG_DOWNLOAD_URL)
            .send()
            .await
            .and_then(|r| r.error_for_status())
    };

    let resp = match try_primary.await {
        Ok(r) => r,
        Err(primary_err) => {
            emit(InstallProgress {
                stage: InstallStage::Starting,
                bytes_done: 0,
                bytes_total: 0,
                message: "Primary mirror unavailable, trying GitHub…".into(),
            });

            // Resolve the real download URL from the GitHub Releases API.
            let api_resp = client
                .get(FFMPEG_GH_API_LATEST)
                .header("Accept", "application/vnd.github+json")
                .send()
                .await
                .and_then(|r| r.error_for_status())
                .map_err(|e| {
                    AppError::Media(format!("download: primary={primary_err} fallback_api={e}"))
                })?;

            let json: serde_json::Value = api_resp
                .json()
                .await
                .map_err(|e| AppError::Media(format!("download: parse GitHub API json: {e}")))?;

            let asset_url = json["assets"]
                .as_array()
                .and_then(|assets| {
                    assets.iter().find_map(|a| {
                        let name = a["name"].as_str()?;
                        if name.ends_with("essentials_build.zip") {
                            a["browser_download_url"].as_str().map(String::from)
                        } else {
                            None
                        }
                    })
                })
                .ok_or_else(|| {
                    AppError::Media(
                        "download: no essentials_build.zip asset in latest GitHub release"
                            .into(),
                    )
                })?;

            client
                .get(&asset_url)
                .send()
                .await
                .and_then(|r| r.error_for_status())
                .map_err(|e| AppError::Media(format!("download: github asset: {e}")))?
        }
    };

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut buf: Vec<u8> = Vec::with_capacity(total as usize);
    let mut stream = resp.bytes_stream();

    let mut next_emit = std::time::Instant::now();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| AppError::Media(format!("download chunk: {e}")))?;
        downloaded += chunk.len() as u64;
        buf.extend_from_slice(&chunk);

        if next_emit.elapsed() >= std::time::Duration::from_millis(250) {
            emit(InstallProgress {
                stage: InstallStage::Downloading,
                bytes_done: downloaded,
                bytes_total: total,
                message: format!(
                    "Downloading FFmpeg ({:.1} / {:.1} MB)",
                    downloaded as f64 / 1024.0 / 1024.0,
                    total as f64 / 1024.0 / 1024.0,
                ),
            });
            next_emit = std::time::Instant::now();
        }
    }

    emit(InstallProgress {
        stage: InstallStage::Extracting,
        bytes_done: downloaded,
        bytes_total: total,
        message: "Extracting archive…".into(),
    });

    extract_ffmpeg_binaries(&buf, &target_dir).map_err(|e| {
        let msg = format!("extract: {e}");
        let app2 = app.clone();
        let _ = app2.emit(
            "ffmpeg:install_progress",
            &InstallProgress {
                stage: InstallStage::Failed,
                bytes_done: downloaded,
                bytes_total: total,
                message: msg.clone(),
            },
        );
        AppError::Media(msg)
    })?;

    let final_path = target_dir.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
    emit(InstallProgress {
        stage: InstallStage::Installed,
        bytes_done: downloaded,
        bytes_total: total,
        message: format!("Installed at {}", final_path.display()),
    });

    Ok(final_path.to_string_lossy().to_string())
}

/// Walk a zip archive in memory, find `ffmpeg.exe` and `ffprobe.exe` (anywhere
/// in the tree — gyan.dev nests them under `ffmpeg-N.N-essentials_build/bin/`)
/// and write them to `target_dir`.
fn extract_ffmpeg_binaries(zip_bytes: &[u8], target_dir: &Path) -> std::io::Result<()> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(std::io::Error::other)?;

    let wanted = [
        if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" },
        if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" },
    ];
    let mut found: u32 = 0;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(std::io::Error::other)?;
        let name = file.name().to_string();
        let basename = std::path::Path::new(&name)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if !wanted.contains(&basename) {
            continue;
        }
        let out_path = target_dir.join(basename);
        let mut out_file = std::fs::File::create(&out_path)?;
        let mut data = Vec::with_capacity(file.size() as usize);
        file.read_to_end(&mut data)?;
        out_file.write_all(&data)?;
        found += 1;
        if found == wanted.len() as u32 {
            break;
        }
    }

    if found < wanted.len() as u32 {
        return Err(std::io::Error::other(format!(
            "archive missing one of {:?}; found {found}",
            wanted
        )));
    }
    Ok(())
}
