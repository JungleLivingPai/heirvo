//! Diagnostic bundle export.
//!
//! Single-click "Export diagnostic bundle" zips up everything support would
//! need to debug a user's recovery without ever asking for video content:
//!
//! - The latest log file (`recovery.log`)
//! - The session's compressed sector map (from SQLite, decoded back to bytes)
//! - The session row + recovery passes + sector errors (as JSON)
//! - System info: OS version, drive INQUIRY data, ffmpeg presence
//!
//! Output: a single .zip the user can email to support. No personal data,
//! no actual video frames.

use crate::error::{AppError, AppResult};
use crate::session::manager;
use crate::state::AppState;
use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use sqlx::Row;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct DiagnosticBundle {
    pub zip_path: String,
    pub bytes: u64,
    pub session_id: String,
}

#[tauri::command]
pub async fn export_diagnostic_bundle(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    output_path: Option<String>,
) -> AppResult<DiagnosticBundle> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;

    // 1. Session core record
    let session_json = serde_json::to_string_pretty(&session)?;

    // 2. Recovery passes
    let passes_rows = sqlx::query(
        "SELECT * FROM recovery_passes WHERE session_id = ? ORDER BY pass_number",
    )
    .bind(id.to_string())
    .fetch_all(&state.db.pool)
    .await?;
    let passes: Vec<serde_json::Value> = passes_rows
        .iter()
        .map(|r| {
            json!({
                "pass_number": r.try_get::<i64, _>("pass_number").unwrap_or(0),
                "strategy": r.try_get::<String, _>("strategy").unwrap_or_default(),
                "started_at": r.try_get::<Option<i64>, _>("started_at").unwrap_or(None),
                "completed_at": r.try_get::<Option<i64>, _>("completed_at").unwrap_or(None),
                "sectors_good": r.try_get::<i64, _>("sectors_good").unwrap_or(0),
                "sectors_failed": r.try_get::<i64, _>("sectors_failed").unwrap_or(0),
                "sectors_skipped": r.try_get::<i64, _>("sectors_skipped").unwrap_or(0),
            })
        })
        .collect();

    // 3. Sector errors (head sample only — full set could be huge)
    let error_rows = sqlx::query(
        "SELECT * FROM sector_errors WHERE session_id = ? ORDER BY occurred_at DESC LIMIT 1000",
    )
    .bind(id.to_string())
    .fetch_all(&state.db.pool)
    .await?;
    let error_count_total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sector_errors WHERE session_id = ?")
            .bind(id.to_string())
            .fetch_one(&state.db.pool)
            .await
            .unwrap_or(0);
    let errors: Vec<serde_json::Value> = error_rows
        .iter()
        .map(|r| {
            json!({
                "lba": r.try_get::<i64, _>("lba").unwrap_or(0),
                "error_code": r.try_get::<String, _>("error_code").unwrap_or_default(),
                "attempt_num": r.try_get::<i64, _>("attempt_num").unwrap_or(0),
                "occurred_at": r.try_get::<i64, _>("occurred_at").unwrap_or(0),
            })
        })
        .collect();

    // 4. Output files
    let output_rows =
        sqlx::query("SELECT * FROM output_files WHERE session_id = ? ORDER BY created_at")
            .bind(id.to_string())
            .fetch_all(&state.db.pool)
            .await?;
    let outputs: Vec<serde_json::Value> = output_rows
        .iter()
        .map(|r| {
            json!({
                "file_type": r.try_get::<String, _>("file_type").unwrap_or_default(),
                "size_bytes": r.try_get::<Option<i64>, _>("size_bytes").unwrap_or(None),
                "status": r.try_get::<String, _>("status").unwrap_or_default(),
                "created_at": r.try_get::<i64, _>("created_at").unwrap_or(0),
                // Path intentionally redacted — may contain a personal disc title.
            })
        })
        .collect();

    // 5. Sector-map blob (compressed, opaque)
    let map_row = sqlx::query("SELECT data, total, checksum FROM sector_maps WHERE session_id = ?")
        .bind(id.to_string())
        .fetch_optional(&state.db.pool)
        .await?;
    let map_bytes: Option<Vec<u8>> = map_row.as_ref().and_then(|r| r.try_get("data").ok());
    let map_total: Option<i64> = map_row.as_ref().and_then(|r| r.try_get("total").ok());
    let map_checksum: Option<String> = map_row.as_ref().and_then(|r| r.try_get("checksum").ok());

    // 6. System info — minimal, no PII
    let system_info = json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "app_version": env!("CARGO_PKG_VERSION"),
        "exported_at": Utc::now().to_rfc3339(),
    });

    let summary = json!({
        "session": serde_json::from_str::<serde_json::Value>(&session_json)?,
        "passes": passes,
        "outputs": outputs,
        "errors_total": error_count_total,
        "errors_sample": errors,
        "sector_map": {
            "total_sectors": map_total,
            "compressed_size_bytes": map_bytes.as_ref().map(|b| b.len()),
            "checksum": map_checksum,
        },
        "system": system_info,
    });

    // Decide output path
    let target = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let docs = app
                .path()
                .document_dir()
                .map_err(|e| AppError::Internal(format!("document_dir: {e}")))?;
            let stamp = Utc::now().format("%Y%m%d-%H%M%S");
            docs.join(format!("dvd-rescue-diagnostic-{stamp}.zip"))
        }
    };
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Write the zip
    let file = std::fs::File::create(&target)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: zip::write::FileOptions<()> =
        zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("summary.json", opts)
        .map_err(|e| AppError::Internal(format!("zip summary: {e}")))?;
    zip.write_all(serde_json::to_string_pretty(&summary)?.as_bytes())?;

    if let Some(bytes) = map_bytes {
        zip.start_file("sector-map.zstd", opts)
            .map_err(|e| AppError::Internal(format!("zip map: {e}")))?;
        zip.write_all(&bytes)?;
    }

    // Recent log file
    let log_path = log_file_path();
    if let Ok(log) = std::fs::read(&log_path) {
        zip.start_file("recovery.log", opts)
            .map_err(|e| AppError::Internal(format!("zip log: {e}")))?;
        zip.write_all(&log)?;
    }

    zip.finish()
        .map_err(|e| AppError::Internal(format!("zip finish: {e}")))?;

    let bytes = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);

    Ok(DiagnosticBundle {
        zip_path: target.to_string_lossy().to_string(),
        bytes,
        session_id: id.to_string(),
    })
}

/// Canonical path to the rolling log file. Mirrors `lib.rs::run()` exactly so
/// that "View log" surfaces the same file that was being written to.
fn log_file_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.heirvo.app")
        .join("recovery.log")
}

/// Returns the absolute path to the rolling log file as a string. The UI
/// uses this for a "View log" affordance.
#[tauri::command]
pub async fn get_log_path() -> AppResult<String> {
    Ok(log_file_path().to_string_lossy().to_string())
}

/// Reveal the log folder in the user's file manager (Explorer on Windows).
/// Falls back to opening the parent directory if the log file doesn't exist
/// yet.
#[tauri::command]
pub async fn open_log_folder() -> AppResult<()> {
    let path = log_file_path();
    let target: PathBuf = if path.exists() {
        // Open Explorer with the file selected.
        return reveal_in_explorer(&path);
    } else {
        // No log yet — open the parent dir at least.
        path.parent().map(|p| p.to_path_buf()).unwrap_or(path)
    };
    if let Some(parent) = target.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::create_dir_all(&target);
    open_path(&target)
}

#[cfg(windows)]
fn reveal_in_explorer(path: &std::path::Path) -> AppResult<()> {
    // /select, asks Explorer to open the parent and highlight the file.
    let arg = format!("/select,{}", path.display());
    std::process::Command::new("explorer.exe")
        .arg(&arg)
        .spawn()
        .map(|_| ())
        .map_err(|e| AppError::Internal(format!("explorer.exe: {e}")))
}

#[cfg(not(windows))]
fn reveal_in_explorer(path: &std::path::Path) -> AppResult<()> {
    open_path(path.parent().unwrap_or(path))
}

#[cfg(windows)]
fn open_path(path: &std::path::Path) -> AppResult<()> {
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| AppError::Internal(format!("explorer.exe: {e}")))
}

#[cfg(not(windows))]
fn open_path(path: &std::path::Path) -> AppResult<()> {
    let cmd = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(cmd)
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| AppError::Internal(format!("{cmd}: {e}")))
}
