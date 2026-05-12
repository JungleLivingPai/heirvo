//! Recovery control commands.

use crate::error::{AppError, AppResult};
use crate::recovery::engine::RecoveryEngine;
use crate::recovery::passes::{pass_plan, RecoveryMode};
use crate::session::manager::{self, SessionStatus};
use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use uuid::Uuid;

#[tauri::command]
pub async fn start_recovery(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    mode: Option<RecoveryMode>,
) -> AppResult<()> {
    let mode = mode.unwrap_or_default();
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;

    if state.engines.read().contains_key(&id) {
        return Err(AppError::RecoveryInProgress(session_id));
    }

    let session = manager::get(&state.db, id).await?;
    tracing::info!("start_recovery: opening drive {}", session.drive_path);

    #[cfg(windows)]
    let reader: Arc<dyn crate::disc::sector::SectorReader> = {
        use crate::disc::scsi_windows::ScsiSectorReader;
        use crate::disc::sector::SectorReader;
        let r = ScsiSectorReader::open(&session.drive_path)
            .map_err(|e| AppError::Drive(format!("open {}: {e}", session.drive_path)))?;
        tracing::info!(
            "start_recovery: drive open ok, capacity {} sectors",
            r.capacity()
        );
        Arc::new(r)
    };

    #[cfg(not(windows))]
    let reader: Arc<dyn crate::disc::sector::SectorReader> = {
        let _ = session;
        return Err(AppError::NotImplemented("non-Windows recovery"));
    };

    let (tx, mut rx) = mpsc::unbounded_channel();
    let (ckpt_tx, mut ckpt_rx) = mpsc::unbounded_channel();
    tracing::info!("start_recovery: mode={:?}", mode);
    let engine = Arc::new(
        RecoveryEngine::new(id, reader, pass_plan(mode))
            .with_mode(mode)
            .with_progress_channel(tx)
            .with_checkpoint_channel(ckpt_tx),
    );

    // Restore prior sector map if present (resume).
    match manager::load_sector_map(&state.db, id).await? {
        Some(map) => {
            tracing::info!("start_recovery: restored sector map ({} sectors)", map.total());
            engine.restore_map(map);
        }
        None => {
            tracing::info!("start_recovery: no prior sector map, starting fresh");
        }
    }

    state.engines.write().insert(id, engine.clone());
    tracing::info!("start_recovery: engine registered, spawning blocking task");
    manager::update_status(&state.db, id, SessionStatus::Recovering).await?;

    // Spawn the recovery task.
    let engine_for_task = engine.clone();
    let db = state.db.clone();
    let app_for_save = app.clone();
    tokio::task::spawn_blocking(move || {
        tracing::info!("recovery task: entering engine.run()");
        let final_state = engine_for_task.run();
        tracing::info!("recovery task: engine.run() returned {:?}", final_state);
        // Persist final sector map.
        let map = engine_for_task.snapshot_map();
        let id = engine_for_task.session_id;
        let final_status = match final_state {
            crate::recovery::engine::EngineState::Completed => SessionStatus::Completed,
            crate::recovery::engine::EngineState::Cancelled => SessionStatus::Cancelled,
            _ => SessionStatus::Failed,
        };
        tauri::async_runtime::block_on(async move {
            if let Err(e) = manager::save_sector_map(&db, id, &map).await {
                tracing::error!("save_sector_map failed: {e:?}");
            }
            if let Err(e) = manager::update_status(&db, id, final_status).await {
                tracing::error!("update_status failed: {e:?}");
            }
            let _ = app_for_save.emit("recovery:complete", id.to_string());
        });
    });

    // Forward progress events to the frontend.
    tokio::spawn(async move {
        while let Some(progress) = rx.recv().await {
            let _ = app.emit("recovery:progress", &progress);
        }
    });

    // Persist sector map on each checkpoint signal.
    let db_for_ckpt = state.db.clone();
    let engine_for_ckpt = engine.clone();
    tokio::spawn(async move {
        while ckpt_rx.recv().await.is_some() {
            let map = engine_for_ckpt.snapshot_map();
            if let Err(e) = manager::save_sector_map(&db_for_ckpt, id, &map).await {
                tracing::warn!("checkpoint save_sector_map failed: {e:?}");
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn pause_recovery(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<()> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let engine = state.engines.read().get(&id).cloned();
    if let Some(engine) = engine {
        engine.pause();
        manager::update_status(&state.db, id, SessionStatus::Paused).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_recovery(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<()> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    if let Some(engine) = state.engines.write().remove(&id) {
        engine.cancel();
    }
    manager::update_status(&state.db, id, SessionStatus::Cancelled).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_sector_map(
    state: State<'_, AppState>,
    session_id: String,
    buckets: usize,
) -> AppResult<Vec<u8>> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;

    // Prefer live engine snapshot; fall back to persisted map.
    if let Some(engine) = state.engines.read().get(&id).cloned() {
        return Ok(engine.snapshot_map().downsample(buckets));
    }
    let map = manager::load_sector_map(&state.db, id)
        .await?
        .ok_or_else(|| AppError::SessionNotFound(session_id))?;
    Ok(map.downsample(buckets))
}

#[derive(Debug, serde::Serialize)]
pub struct RmapExport {
    pub path: String,
    pub bytes_written: u64,
    pub run_count: u64,
}

/// Export the session's sector map to a ddrescue-format `.rmap` text file.
#[tauri::command]
pub async fn export_rmap(
    state: State<'_, AppState>,
    session_id: String,
    output_path: Option<String>,
) -> AppResult<RmapExport> {
    use std::path::PathBuf;
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;

    // Prefer live engine snapshot; fall back to persisted map.
    let live = state.engines.read().get(&id).cloned();
    let map = if let Some(engine) = live {
        engine.snapshot_map()
    } else {
        manager::load_sector_map(&state.db, id)
            .await?
            .ok_or_else(|| AppError::SessionNotFound(session_id.clone()))?
    };

    let header = crate::recovery::rmap::RmapHeader {
        disc_label: Some(session.disc_label.clone()),
        disc_fingerprint: Some(session.disc_fingerprint.clone()),
        current_pass: session.current_pass.max(1) as u32,
        app_version: env!("CARGO_PKG_VERSION"),
    };
    let text = crate::recovery::rmap::encode(&map, &header);

    let target = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let safe: String = session
                .disc_label
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
                .collect();
            let stem = if safe.is_empty() { "recovered".into() } else { safe };
            PathBuf::from(&session.output_dir).join(format!("{stem}.rmap"))
        }
    };
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&target, text.as_bytes())?;

    let bytes_written = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
    let run_count = text
        .lines()
        .filter(|l| l.starts_with("0x") && !l.contains('?') && !l.starts_with("0x0  "))
        .count() as u64;
    // Subtract one for the current_pos header line that may slip through:
    let run_count = run_count.saturating_sub(0);

    Ok(RmapExport {
        path: target.to_string_lossy().to_string(),
        bytes_written,
        run_count,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct RmapImport {
    pub good_sectors: u64,
    pub failed_sectors: u64,
    pub skipped_sectors: u64,
    pub unknown_sectors: u64,
}

/// Replace the session's sector map with one parsed from a `.rmap` file. Use
/// case: user ran a recovery on another machine with ddrescue, or restored
/// from a diagnostic bundle, and wants to continue from that state.
#[tauri::command]
pub async fn import_rmap(
    state: State<'_, AppState>,
    session_id: String,
    input_path: String,
) -> AppResult<RmapImport> {
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| AppError::SessionNotFound(session_id.clone()))?;
    let session = manager::get(&state.db, id).await?;

    if state.engines.read().contains_key(&id) {
        return Err(AppError::RecoveryInProgress(session_id));
    }

    let text = std::fs::read_to_string(&input_path)
        .map_err(|e| AppError::Internal(format!("read {input_path}: {e}")))?;
    let map = crate::recovery::rmap::decode(&text, session.total_sectors)
        .map_err(|e| AppError::Internal(format!("parse rmap: {e}")))?;

    use crate::recovery::map::SectorState;
    let summary = RmapImport {
        good_sectors: map.count(SectorState::Good),
        failed_sectors: map.count(SectorState::Failed),
        skipped_sectors: map.count(SectorState::Skipped),
        unknown_sectors: map.count(SectorState::Unknown),
    };
    manager::save_sector_map(&state.db, id, &map).await?;
    Ok(summary)
}
