//! License IPC commands.
//!
//! Frontend calls `get_license_status` on app start; gates the Save buttons
//! on `can_save`. `activate_license` opens a checkout URL externally and
//! validates a returned key. `deactivate_license` clears the local key.

use crate::error::AppResult;
use crate::licensing::{self, LicenseStatus};
use tauri::{AppHandle, Manager};

fn app_data_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

#[tauri::command]
pub async fn get_license_status(app: AppHandle) -> AppResult<LicenseStatus> {
    let dir = app_data_dir(&app);
    Ok(licensing::current(&dir))
}

#[tauri::command]
pub async fn activate_license(app: AppHandle, key: String) -> AppResult<LicenseStatus> {
    let dir = app_data_dir(&app);
    licensing::activate(&dir, &key).await
}

#[tauri::command]
pub async fn deactivate_license(app: AppHandle) -> AppResult<LicenseStatus> {
    let dir = app_data_dir(&app);
    Ok(licensing::deactivate(&dir))
}
