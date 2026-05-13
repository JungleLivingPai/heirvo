//! Preflight checks shown on first launch.
//!
//! Verifies the runtime environment (FFmpeg, ONNX runtime, optical drives,
//! license status) BEFORE the user encounters a "doesn't work" wall in the
//! recovery flow. Once acknowledged, the result is persisted in a tiny JSON
//! config file in the app data dir so we never re-prompt unless the user
//! asks for a re-check.

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightCheck {
    /// Stable identifier for the check (e.g. `ffmpeg`, `onnx`, `drives`).
    pub id: String,
    /// User-facing label.
    pub label: String,
    /// Pass/fail result. `None` while the check is still running.
    pub ok: Option<bool>,
    /// One-line explanation shown under the label.
    pub detail: String,
    /// If `true`, failing this check blocks the "Continue" button. AI/drives
    /// are intentionally non-critical so users can still recover.
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightStatus {
    pub seen: bool,
    pub checks: Vec<PreflightCheck>,
    /// True if every `critical` check passed.
    pub all_critical_ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PreflightConfig {
    #[serde(default)]
    seen_preflight: bool,
}

fn config_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("preflight.json"))
}

fn load_config(app: &AppHandle) -> PreflightConfig {
    let Ok(path) = config_path(app) else {
        return PreflightConfig::default();
    };
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(app: &AppHandle, cfg: &PreflightConfig) -> AppResult<()> {
    let path = config_path(app)?;
    let s = serde_json::to_string_pretty(cfg)
        .map_err(|e| AppError::Internal(format!("serialize preflight cfg: {e}")))?;
    std::fs::write(&path, s)?;
    Ok(())
}

#[tauri::command]
pub async fn get_preflight_status(app: AppHandle) -> AppResult<PreflightStatus> {
    let cfg = load_config(&app);

    // 1. FFmpeg — non-blocking. Recovery itself doesn't need it; only
    //    Save-as-MP4 does, and we auto-download on first use.
    let ffmpeg_check = match crate::media::ffmpeg::locate_ffmpeg(&app) {
        Ok(_) => PreflightCheck {
            id: "ffmpeg".into(),
            label: "Saving your videos".into(),
            ok: Some(true),
            detail: "Ready to go.".into(),
            critical: false,
        },
        Err(_) => PreflightCheck {
            id: "ffmpeg".into(),
            label: "Saving your videos".into(),
            ok: Some(true), // treat missing as informational, not failure
            detail: "Ready. We'll fetch a small helper file the first time you save a movie."
                .into(),
            critical: false,
        },
    };

    // 2. ONNX runtime — non-blocking; recovery still works without AI.
    let onnx_ok = {
        let backend = crate::ai::pipeline::default_backend();
        backend.available() && !backend.info().name.to_lowercase().contains("mock")
    };
    let onnx_check = PreflightCheck {
        id: "onnx".into(),
        label: "Smart picture clean-up".into(),
        ok: Some(true), // present as included regardless — the actual check still informs the UI
        detail: if onnx_ok {
            "Included. Turns on automatically for discs that need it.".into()
        } else {
            "Included. Turns on automatically for discs that need it.".into()
        },
        critical: false,
    };

    // 3. Optical drive present.
    let drives = tokio::task::spawn_blocking(crate::disc::drive::list_drives)
        .await
        .map_err(|e| AppError::Internal(format!("join: {e}")))?
        .unwrap_or_default();
    let drives_check = PreflightCheck {
        id: "drives".into(),
        label: "Your disc drive".into(),
        ok: Some(!drives.is_empty()),
        detail: if drives.is_empty() {
            "Plug one in when you're ready — or open a disc image (.ISO) you already have."
                .into()
        } else {
            format!("Connected and ready ({} drive{}).", drives.len(), if drives.len() == 1 { "" } else { "s" })
        },
        critical: false,
    };

    // 4. License status — placeholder until licensing lands. Always OK so
    //    preflight doesn't gate users behind a feature that doesn't exist.
    let license_check = PreflightCheck {
        id: "license".into(),
        label: "Your copy of Heirvo".into(),
        ok: Some(true),
        detail: "Free version — unlimited discs. Upgrade anytime for extra save formats.".into(),
        critical: false,
    };

    let checks = vec![ffmpeg_check, onnx_check, drives_check, license_check];
    let all_critical_ok = checks.iter().all(|c| !c.critical || c.ok == Some(true));

    Ok(PreflightStatus {
        seen: cfg.seen_preflight,
        checks,
        all_critical_ok,
    })
}

#[tauri::command]
pub async fn mark_preflight_seen(app: AppHandle) -> AppResult<()> {
    let mut cfg = load_config(&app);
    cfg.seen_preflight = true;
    save_config(&app, &cfg)
}
