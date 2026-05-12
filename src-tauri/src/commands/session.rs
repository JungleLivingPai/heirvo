//! Session lifecycle commands.

use crate::error::{AppError, AppResult};
use crate::session::manager::{self, Session};
use crate::state::AppState;
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateSessionArgs {
    pub disc_label: String,
    pub disc_fingerprint: String,
    pub drive_path: String,
    pub total_sectors: u64,
    pub output_dir: String,
    /// Disc type as a stringified `DiscType` variant (e.g. "DvdVideo").
    /// Optional for backwards-compat with older callers.
    #[serde(default)]
    pub disc_type: Option<String>,
}

#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    args: CreateSessionArgs,
) -> AppResult<Session> {
    manager::create(
        &state.db,
        &args.disc_label,
        &args.disc_fingerprint,
        &args.drive_path,
        args.total_sectors,
        &args.output_dir,
        args.disc_type.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn list_sessions(state: State<'_, AppState>) -> AppResult<Vec<Session>> {
    manager::list_all(&state.db).await
}

#[tauri::command]
pub async fn resume_session(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<Session> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    manager::get(&state.db, id).await
}

#[tauri::command]
pub async fn delete_session(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<()> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    manager::delete(&state.db, id).await
}

/// Set a user-friendly label on a session (e.g. "Mom's Wedding 1998").
/// Pass an empty string to clear the label and revert to the disc_label.
#[tauri::command]
pub async fn rename_session(
    state: State<'_, AppState>,
    session_id: String,
    label: String,
) -> AppResult<()> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    manager::rename(&state.db, id, Some(&label)).await
}

/// Change the drive path on a paused / completed session. Useful when the
/// user wants to retry failed sectors with a different (more capable) drive.
/// Refuses if a recovery is currently running on this session.
#[tauri::command]
pub async fn change_drive(
    state: State<'_, AppState>,
    session_id: String,
    new_drive_path: String,
) -> AppResult<Session> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    if state.engines.read().contains_key(&id) {
        return Err(AppError::RecoveryInProgress(session_id));
    }
    manager::update_drive_path(&state.db, id, &new_drive_path).await?;
    manager::get(&state.db, id).await
}

/// Change the output directory of an existing session. Useful when the
/// user plugs in an external/USB drive after starting recovery and wants
/// to save the recovered files there instead of the original location.
#[tauri::command]
pub async fn change_output_dir(
    state: State<'_, AppState>,
    session_id: String,
    new_output_dir: String,
) -> AppResult<Session> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    manager::update_output_dir(&state.db, id, &new_output_dir).await?;
    manager::get(&state.db, id).await
}
