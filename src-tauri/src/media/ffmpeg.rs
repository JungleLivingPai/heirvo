//! FFmpeg integration via child process.
//!
//! We deliberately shell out to `ffmpeg.exe` rather than link via `ffmpeg-next`:
//! - LGPL boundary stays clean (we ship the binary, not link against it).
//! - Faster build, no native FFmpeg dev install required.
//! - Easy to swap in different builds (gpl-vs-lgpl, hardware-accel variants).
//!
//! FFmpeg lookup order:
//!   1. `<resource_dir>/ffmpeg/ffmpeg.exe`         (bundled with installer)
//!   2. `<app_data_dir>/ffmpeg/ffmpeg.exe`         (downloaded on first use)
//!   3. `ffmpeg` on system PATH                    (developer/user install)
//!
//! Progress is parsed from stderr: FFmpeg writes `frame=` and `time=` lines
//! periodically. We use the more reliable `-progress pipe:2` output which
//! emits key=value pairs flushed every 500ms.

use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

#[cfg(windows)]
const FFMPEG_BIN: &str = "ffmpeg.exe";
#[cfg(not(windows))]
const FFMPEG_BIN: &str = "ffmpeg";

#[cfg(windows)]
const FFPROBE_BIN: &str = "ffprobe.exe";
#[cfg(not(windows))]
const FFPROBE_BIN: &str = "ffprobe";

/// Locate ffmpeg/ffprobe in priority order. Returns `None` if not found.
pub fn locate(app: &AppHandle, binary: &str) -> Option<PathBuf> {
    // 1. Bundled resource — check known layouts. Tauri 2's `resource_dir()`
    //    returns the install root on Windows NSIS (not `<root>/resources/`),
    //    so we have to look in both places to be safe across bundle types.
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Layout A: <resource_dir>/ffmpeg/<binary>
        let p = resource_dir.join("ffmpeg").join(binary);
        if p.exists() {
            return Some(p);
        }
        // Layout B: <resource_dir>/resources/ffmpeg/<binary>
        let p = resource_dir.join("resources").join("ffmpeg").join(binary);
        if p.exists() {
            return Some(p);
        }
    }
    // 1b. Walk up from the running exe — handles edge cases where
    //     resource_dir() points to a portable AppData layout.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p = parent.join("resources").join("ffmpeg").join(binary);
            if p.exists() {
                return Some(p);
            }
            let p = parent.join("ffmpeg").join(binary);
            if p.exists() {
                return Some(p);
            }
        }
    }
    // 2. App data dir (downloaded).
    if let Ok(data_dir) = app.path().app_data_dir() {
        let p = data_dir.join("ffmpeg").join(binary);
        if p.exists() {
            return Some(p);
        }
    }
    // 3. System PATH.
    if let Ok(path_var) = std::env::var("PATH") {
        let sep = if cfg!(windows) { ';' } else { ':' };
        for entry in path_var.split(sep) {
            let p = Path::new(entry).join(binary);
            if p.exists() {
                return Some(p);
            }
        }
    }
    None
}

pub fn locate_ffmpeg(app: &AppHandle) -> AppResult<PathBuf> {
    locate(app, FFMPEG_BIN)
        .ok_or_else(|| AppError::Media("ffmpeg not found — install it or place ffmpeg.exe in resources/ffmpeg/".into()))
}

pub fn locate_ffprobe(app: &AppHandle) -> AppResult<PathBuf> {
    locate(app, FFPROBE_BIN)
        .ok_or_else(|| AppError::Media("ffprobe not found".into()))
}

/// Progress event emitted while a transcode job runs.
#[derive(Debug, Clone, serde::Serialize)]
pub struct FfmpegProgress {
    pub frame: u64,
    pub fps: f32,
    pub bitrate_kbps: f32,
    pub out_time_us: u64,
    pub speed: f32,
    pub progress: String, // "continue" or "end"
}

/// Run ffmpeg with the supplied argument list, streaming progress events.
///
/// `total_duration_secs` is used to compute a percentage; pass `None` to skip.
pub async fn run_with_progress(
    bin: &Path,
    args: &[String],
    on_progress: Arc<dyn Fn(FfmpegProgress) + Send + Sync>,
    cancel: Option<tokio::sync::watch::Receiver<bool>>,
) -> AppResult<()> {
    tracing::info!("ffmpeg {}", args.join(" "));
    let mut cmd = Command::new(bin);
    cmd.args(args)
        .args(["-progress", "pipe:1", "-nostats"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child: Child = cmd
        .spawn()
        .map_err(|e| AppError::Media(format!("spawn ffmpeg: {e}")))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Media("no ffmpeg stdout".into()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::Media("no ffmpeg stderr".into()))?;

    let (parsed_tx, mut parsed_rx) = mpsc::unbounded_channel::<FfmpegProgress>();
    tokio::spawn(parse_progress_stream(stdout, parsed_tx));
    tokio::spawn(log_stderr(stderr));

    if let Some(mut cancel_rx) = cancel {
        let pid = child.id();
        tokio::spawn(async move {
            loop {
                if cancel_rx.changed().await.is_err() {
                    return;
                }
                if *cancel_rx.borrow() {
                    if let Some(pid) = pid {
                        tracing::info!("Cancelling ffmpeg pid {pid}");
                        #[cfg(windows)]
                        {
                            let _ = std::process::Command::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .output();
                        }
                    }
                    return;
                }
            }
        });
    }

    while let Some(p) = parsed_rx.recv().await {
        on_progress(p);
    }

    let status = child
        .wait()
        .await
        .map_err(|e| AppError::Media(format!("ffmpeg wait: {e}")))?;

    if !status.success() {
        return Err(AppError::Media(format!(
            "ffmpeg exited with status {}",
            status.code().unwrap_or(-1)
        )));
    }

    Ok(())
}

async fn parse_progress_stream<R: tokio::io::AsyncRead + Unpin>(
    stdout: R,
    tx: mpsc::UnboundedSender<FfmpegProgress>,
) {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut current = FfmpegProgress {
        frame: 0,
        fps: 0.0,
        bitrate_kbps: 0.0,
        out_time_us: 0,
        speed: 0.0,
        progress: String::new(),
    };

    while let Ok(Some(line)) = lines.next_line().await {
        let Some((k, v)) = line.split_once('=') else { continue };
        match k.trim() {
            "frame" => current.frame = v.trim().parse().unwrap_or(0),
            "fps" => current.fps = v.trim().parse().unwrap_or(0.0),
            "bitrate" => {
                // e.g. "1234.5kbits/s"
                let s = v.trim().trim_end_matches("kbits/s").trim();
                current.bitrate_kbps = s.parse().unwrap_or(0.0);
            }
            "out_time_us" | "out_time_ms" => {
                // Despite the name, FFmpeg emits microseconds for both keys in modern builds.
                current.out_time_us = v.trim().parse().unwrap_or(0);
            }
            "speed" => {
                let s = v.trim().trim_end_matches('x').trim();
                current.speed = s.parse().unwrap_or(0.0);
            }
            "progress" => {
                current.progress = v.trim().to_string();
                let _ = tx.send(current.clone());
                if current.progress == "end" {
                    break;
                }
            }
            _ => {}
        }
    }
}

async fn log_stderr<R: tokio::io::AsyncRead + Unpin>(stderr: R) {
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        tracing::debug!(target: "ffmpeg", "{}", line);
    }
}

/// Probe a media file for duration, codec, and stream info via ffprobe.
pub async fn probe(bin: &Path, input: &Path) -> AppResult<ProbeResult> {
    let output = Command::new(bin)
        .args([
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(input)
        .output()
        .await
        .map_err(|e| AppError::Media(format!("spawn ffprobe: {e}")))?;

    if !output.status.success() {
        return Err(AppError::Media(format!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    let duration = parsed
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let mut video_codec = String::new();
    let mut audio_codec = String::new();
    let mut width: u32 = 0;
    let mut height: u32 = 0;
    let mut interlaced = false;
    let mut fps_num: u32 = 30;
    let mut fps_den: u32 = 1;

    if let Some(streams) = parsed.get("streams").and_then(|s| s.as_array()) {
        for s in streams {
            let codec_type = s.get("codec_type").and_then(|v| v.as_str()).unwrap_or("");
            let codec_name = s.get("codec_name").and_then(|v| v.as_str()).unwrap_or("");
            match codec_type {
                "video"
                    if video_codec.is_empty() => {
                        video_codec = codec_name.into();
                        width = s.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        height = s.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        if let Some(field) = s.get("field_order").and_then(|v| v.as_str()) {
                            if field == "tt" || field == "bb" || field == "tb" || field == "bt" {
                                interlaced = true;
                            }
                        }
                        // r_frame_rate is "num/den" (e.g. "30000/1001" for NTSC).
                        if let Some(rfr) = s.get("r_frame_rate").and_then(|v| v.as_str()) {
                            if let Some((n, d)) = rfr.split_once('/') {
                                if let (Ok(num), Ok(den)) = (n.parse(), d.parse()) {
                                    fps_num = num;
                                    fps_den = den;
                                }
                            }
                        }
                    }
                "audio" if audio_codec.is_empty() => audio_codec = codec_name.into(),
                _ => {}
            }
        }
    }

    Ok(ProbeResult {
        duration_secs: duration,
        video_codec,
        audio_codec,
        width,
        height,
        interlaced,
        fps_num,
        fps_den,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProbeResult {
    pub duration_secs: f64,
    pub video_codec: String,
    pub audio_codec: String,
    pub width: u32,
    pub height: u32,
    pub interlaced: bool,
    /// Frame rate as a rational (numerator/denominator) — e.g. 30000/1001
    /// for NTSC. Defaults to 30/1 if ffprobe doesn't report it.
    #[serde(default = "default_fps_num")]
    pub fps_num: u32,
    #[serde(default = "default_fps_den")]
    pub fps_den: u32,
}

fn default_fps_num() -> u32 {
    30
}
fn default_fps_den() -> u32 {
    1
}

impl ProbeResult {
    pub fn fps(&self) -> f64 {
        if self.fps_den == 0 {
            30.0
        } else {
            self.fps_num as f64 / self.fps_den as f64
        }
    }
}
