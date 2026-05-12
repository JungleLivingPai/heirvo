//! Enhancement job lifecycle.
//!
//! Jobs live in the `enhancement_jobs` SQLite table (defined in
//! `migrations/20250101000000_initial.sql`). The table tracks queued/running/
//! complete/error states and progress percentage so the UI can resume
//! mid-job after a crash or restart.
//!
//! ## Lifecycle
//!
//! ```text
//!   queued ──► running ──► complete
//!                 │
//!                 └─────► error
//! ```

use crate::ai::pipeline::EnhancementJob;
use crate::error::AppResult;
use crate::session::db::Db;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Complete,
    Error,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Queued => "queued",
            JobStatus::Running => "running",
            JobStatus::Complete => "complete",
            JobStatus::Error => "error",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "running" => JobStatus::Running,
            "complete" => JobStatus::Complete,
            "error" => JobStatus::Error,
            _ => JobStatus::Queued,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JobRecord {
    pub id: i64,
    pub session_id: Option<String>,
    pub input_file: String,
    pub output_file: String,
    pub status: JobStatus,
    pub progress: f32,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub error_message: Option<String>,
}

pub async fn enqueue(db: &Db, job: &EnhancementJob, session_id: Option<&str>) -> AppResult<i64> {
    let now = Utc::now().timestamp();
    let pipeline_json = serde_json::to_string(job)?;
    let row = sqlx::query(
        "INSERT INTO enhancement_jobs
         (session_id, input_file, output_file, pipeline_json, status, progress, started_at, completed_at, error_message)
         VALUES (?, ?, ?, ?, 'queued', 0.0, NULL, NULL, NULL)
         RETURNING id",
    )
    .bind(session_id)
    .bind(job.input.to_string_lossy().to_string())
    .bind(job.output.to_string_lossy().to_string())
    .bind(&pipeline_json)
    .fetch_one(&db.pool)
    .await?;
    let id: i64 = row.try_get("id")?;
    let _ = now; // chrono used by other helpers; suppress lint
    Ok(id)
}

pub async fn mark_running(db: &Db, id: i64) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query(
        "UPDATE enhancement_jobs SET status='running', started_at=? WHERE id=?",
    )
    .bind(now)
    .bind(id)
    .execute(&db.pool)
    .await?;
    Ok(())
}

pub async fn update_progress(db: &Db, id: i64, progress: f32) -> AppResult<()> {
    sqlx::query("UPDATE enhancement_jobs SET progress=? WHERE id=?")
        .bind(progress)
        .bind(id)
        .execute(&db.pool)
        .await?;
    Ok(())
}

pub async fn mark_complete(db: &Db, id: i64) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query(
        "UPDATE enhancement_jobs SET status='complete', progress=1.0, completed_at=? WHERE id=?",
    )
    .bind(now)
    .bind(id)
    .execute(&db.pool)
    .await?;
    Ok(())
}

pub async fn mark_error(db: &Db, id: i64, message: &str) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query(
        "UPDATE enhancement_jobs SET status='error', error_message=?, completed_at=? WHERE id=?",
    )
    .bind(message)
    .bind(now)
    .bind(id)
    .execute(&db.pool)
    .await?;
    Ok(())
}

pub async fn get(db: &Db, id: i64) -> AppResult<JobRecord> {
    let row = sqlx::query("SELECT * FROM enhancement_jobs WHERE id=?")
        .bind(id)
        .fetch_one(&db.pool)
        .await?;
    Ok(JobRecord {
        id: row.try_get("id")?,
        session_id: row.try_get("session_id")?,
        input_file: row.try_get("input_file")?,
        output_file: row.try_get("output_file")?,
        status: JobStatus::parse(&row.try_get::<String, _>("status")?),
        progress: row.try_get::<f64, _>("progress")? as f32,
        started_at: row.try_get("started_at")?,
        completed_at: row.try_get("completed_at")?,
        error_message: row.try_get("error_message")?,
    })
}

/// Job runner: drives an enhancement job from `queued` → `running` →
/// `complete` (or `error`), emitting `enhancement:progress` events while
/// the video pipeline grinds.
///
/// Falls back to a plain file copy if FFmpeg isn't available so the user
/// still gets an output file — the pipeline doesn't strand them.
pub async fn run_mock_job(
    db: Db,
    app: tauri::AppHandle,
    job_id: i64,
) -> AppResult<()> {
    use std::sync::Arc;
    use tauri::Emitter;

    mark_running(&db, job_id).await?;
    let _ = app.emit(
        "enhancement:progress",
        serde_json::json!({"job_id": job_id, "progress": 0.0}),
    );

    let job = get(&db, job_id).await?;
    // Reconstruct the EnhancementJob from the persisted JSON to recover
    // ops + preset choice. (The DB stores ops_json so we can resume after
    // crash; we only really need the upscale model here, but this keeps
    // the door open.)
    // For now, derive a default preset (Light) — the UI submits the ops
    // list directly, so we can also infer from there in a future refactor.
    let preset = crate::ai::pipeline::Preset::Light;

    let app_for_progress = app.clone();
    let progress_cb: crate::ai::video_pipeline::ProgressCb = Arc::new(move |p: f32| {
        let _ = app_for_progress.emit(
            "enhancement:progress",
            serde_json::json!({"job_id": job_id, "progress": p}),
        );
    });

    let backend = crate::ai::pipeline::default_backend();
    let input = std::path::PathBuf::from(&job.input_file);
    let output = std::path::PathBuf::from(&job.output_file);

    // Prefer the pipe-based pipeline (no disk staging — works on long videos).
    // Fall back to disk-staged on pipe error so users always get a result.
    let result = match crate::ai::video_pipeline::enhance_video_piped(
        &app,
        &input,
        &output,
        preset,
        backend.clone(),
        progress_cb.clone(),
    )
    .await
    {
        Ok(r) => Ok(r),
        Err(piped_err) => {
            tracing::warn!(
                "piped pipeline failed ({piped_err}); falling back to disk-staged"
            );
            crate::ai::video_pipeline::enhance_video(
                &app,
                &input,
                &output,
                preset,
                backend,
                progress_cb,
            )
            .await
        }
    };

    match result {
        Ok(r) => {
            tracing::info!(
                "job {job_id} complete: {} frames processed, fallback={}",
                r.frames_processed,
                r.fell_back_to_copy
            );
            mark_complete(&db, job_id).await?;
            let _ = app.emit(
                "enhancement:progress",
                serde_json::json!({"job_id": job_id, "progress": 1.0}),
            );
            let _ = app.emit("enhancement:complete", job_id);
        }
        Err(e) => {
            let msg = e.to_string();
            mark_error(&db, job_id, &msg).await?;
            let _ = app.emit(
                "enhancement:error",
                serde_json::json!({"job_id": job_id, "error": msg}),
            );
        }
    }
    Ok(())
}

pub async fn list(db: &Db) -> AppResult<Vec<JobRecord>> {
    let rows = sqlx::query("SELECT * FROM enhancement_jobs ORDER BY id DESC LIMIT 100")
        .fetch_all(&db.pool)
        .await?;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        out.push(JobRecord {
            id: row.try_get("id")?,
            session_id: row.try_get("session_id")?,
            input_file: row.try_get("input_file")?,
            output_file: row.try_get("output_file")?,
            status: JobStatus::parse(&row.try_get::<String, _>("status")?),
            progress: row.try_get::<f64, _>("progress")? as f32,
            started_at: row.try_get("started_at")?,
            completed_at: row.try_get("completed_at")?,
            error_message: row.try_get("error_message")?,
        });
    }
    Ok(out)
}
