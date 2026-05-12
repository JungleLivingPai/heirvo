//! Heirvo — Rust core library
//!
//! Modules:
//! - `disc`     — low-level optical drive I/O (SCSI pass-through on Windows)
//! - `recovery` — sector map, multi-pass recovery engine
//! - `dvd`      — DVD structure parsing (IFO/BUP, VIDEO_TS layout)
//! - `media`    — FFmpeg pipeline (transcode, repair, ISO assembly)
//! - `ai`       — ONNX-based enhancement (upscale, interpolate, denoise)
//! - `session`  — SQLite-backed session persistence + resume logic
//! - `commands` — Tauri IPC command handlers

pub mod ai;
pub mod commands;
pub mod disc;
pub mod dvd;
pub mod error;
pub mod licensing;
pub mod media;
pub mod recovery;
pub mod session;
pub mod state;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Log to BOTH stderr (line-buffered, visible in dev terminal) and a file
    // alongside the database (always available even when stdout pipe stalls).
    let log_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("com.heirvo.app")
        .join("recovery.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();

    let stderr_layer = tracing_subscriber::fmt::layer()
        .with_writer(std::io::stderr)
        .with_ansi(false);

    let registry = tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn".into()))
        .with(stderr_layer);

    if let Some(file) = log_file {
        let file_layer = tracing_subscriber::fmt::layer()
            .with_writer(std::sync::Mutex::new(file))
            .with_ansi(false);
        registry.with(file_layer).init();
    } else {
        registry.init();
    }

    tracing::info!("Heirvo starting up — log file at {}", log_path.display());

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());
    // NOTE: tauri-plugin-updater + tauri-plugin-process are temporarily
    // disabled. They require a generated ed25519 keypair (signing key) to
    // function. Re-enable BOTH together once `npx @tauri-apps/cli signer
    // generate` has been run and the public key pasted into tauri.conf.json
    // under bundle.windows.signingIdentity / plugins.updater.pubkey.

    builder
        .setup(|app| {
            let handle = app.handle().clone();
            // Block setup until DB is ready so commands always see initialized state.
            tauri::async_runtime::block_on(async move {
                if let Err(e) = state::AppState::init(&handle).await {
                    tracing::error!("Failed to initialize app state: {e:?}");
                    return Err::<(), _>(e);
                }
                Ok(())
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::drive::list_drives,
            commands::drive::check_disc,
            commands::session::create_session,
            commands::session::list_sessions,
            commands::session::resume_session,
            commands::session::delete_session,
            commands::session::change_drive,
            commands::session::change_output_dir,
            commands::recovery::start_recovery,
            commands::recovery::pause_recovery,
            commands::recovery::cancel_recovery,
            commands::recovery::get_sector_map,
            commands::recovery::export_rmap,
            commands::recovery::import_rmap,
            commands::dvd::analyze_structure,
            commands::dvd::extract_vobs,
            commands::dvd::extract_all_files,
            commands::dvd::health_score,
            commands::media::create_iso,
            commands::media::transcode,
            commands::media::ffmpeg_status,
            commands::media::ffprobe_file,
            commands::media::install_ffmpeg,
            commands::media::save_as_mp4,
            commands::ai::list_models,
            commands::ai::download_model,
            commands::ai::ai_backend_info,
            commands::ai::queue_enhancement,
            commands::ai::get_job_status,
            commands::ai::list_enhancement_jobs,
            commands::ai::enhance_preview,
            commands::diagnostic::export_diagnostic_bundle,
            commands::diagnostic::get_log_path,
            commands::diagnostic::open_log_folder,
            commands::storage::list_storage_drives,
            commands::storage::open_folder,
            commands::session::rename_session,
            commands::license::get_license_status,
            commands::license::activate_license,
            commands::license::deactivate_license,
            commands::audio::read_audio_toc,
            commands::audio::extract_audio_tracks,
            commands::preflight::get_preflight_status,
            commands::preflight::mark_preflight_seen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
