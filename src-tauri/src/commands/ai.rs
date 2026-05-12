//! AI enhancement commands.

use crate::ai::backend::BackendInfo;
use crate::ai::jobs::{self, JobRecord};
use crate::ai::models::{catalog_for, AiModel, ModelCatalog};
use crate::ai::pipeline::EnhancementJob;
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn list_models(app: AppHandle) -> AppResult<ModelCatalog> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    Ok(catalog_for(&data_dir))
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    model: AiModel,
) -> AppResult<crate::ai::model_downloader::DownloadResult> {
    crate::ai::model_downloader::download_model(app, model).await
}

/// Returns the active AI backend's info — name, device, tile size limits.
/// Frontend uses this to surface "Mock backend (no GPU)" vs "DirectML on
/// NVIDIA RTX 4070" so users know what they're getting.
#[tauri::command]
pub async fn ai_backend_info() -> AppResult<BackendInfo> {
    let backend = crate::ai::pipeline::default_backend();
    Ok(backend.info())
}

/// Queue an enhancement job. Returns the new job's id; subscribe to the
/// `enhancement:progress` event to watch it run, `enhancement:complete` for
/// done, `enhancement:error` for failure.
///
/// MVP behavior: copies input → output while emitting progress. Real pipeline
/// (FFmpeg frame extraction → AI tile dispatch → reassembly) lands when the
/// ONNX backend is wired; the events + lifecycle stay the same.
#[tauri::command]
pub async fn queue_enhancement(
    app: AppHandle,
    state: State<'_, AppState>,
    job: EnhancementJob,
) -> AppResult<i64> {
    let id = jobs::enqueue(&state.db, &job, None).await?;
    let db_clone = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = jobs::run_mock_job(db_clone, app, id).await {
            tracing::error!("enhancement job {id} failed: {e:?}");
        }
    });
    Ok(id)
}

#[tauri::command]
pub async fn get_job_status(
    state: State<'_, AppState>,
    job_id: i64,
) -> AppResult<JobRecord> {
    jobs::get(&state.db, job_id).await
}

#[tauri::command]
pub async fn list_enhancement_jobs(state: State<'_, AppState>) -> AppResult<Vec<JobRecord>> {
    jobs::list(&state.db).await
}

/// Generate a single-frame before/after preview for the user to inspect
/// before committing to a full transcode. Pulls one frame from `input` at
/// `timestamp_secs`, runs it through the active AI backend with the chosen
/// preset, and returns the paths of two PNGs the UI can show side-by-side.
#[tauri::command]
pub async fn enhance_preview(
    app: AppHandle,
    input: String,
    timestamp_secs: f32,
    preset: crate::ai::pipeline::Preset,
) -> AppResult<crate::ai::preview::PreviewResult> {
    let backend = crate::ai::pipeline::default_backend();
    crate::ai::preview::generate(
        &app,
        std::path::Path::new(&input),
        timestamp_secs,
        preset,
        backend,
    )
    .await
}
