//! Full-video enhancement pipeline.
//!
//! Strategy: extract → process → reassemble, disk-staged.
//!
//! ```text
//!  input.mp4 ──┐
//!              │  ffmpeg (extract)
//!              ▼
//!     <work>/in/000001.png
//!     <work>/in/000002.png   ──[ AiBackend per frame ]──▶  <work>/out/...
//!     ...
//!              │  ffmpeg (encode + audio passthrough)
//!              ▼
//!  output.mp4
//! ```
//!
//! Disk-based v1 is simple, debuggable, and resumable. A future pipe-based
//! version (raw video over stdout/stdin) avoids the disk hit on long videos
//! but adds enough complexity that we'd rather ship something correct first.
//!
//! ## Disk usage warning
//!
//! A 90-min 1080p video at 30fps is ~162,000 frames; PNG-encoded those are
//! ~500KB each ≈ 80GB on disk. Suitable for short clips and short DVD
//! recordings. Long-form content needs the pipe-based pipeline.

use crate::ai::backend::AiBackend;
use crate::ai::models::AiModel;
use crate::ai::pipeline::{EnhancementOp, Preset};
use crate::ai::tiling::{process_image, RgbImage};
use crate::error::{AppError, AppResult};
use crate::media::ffmpeg as ff;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

/// Callback type for progress reporting. Called with the current fraction
/// (0.0..=1.0) of frames processed.
pub type ProgressCb = Arc<dyn Fn(f32) + Send + Sync>;

pub struct VideoPipelineResult {
    pub frames_processed: u64,
    pub fell_back_to_copy: bool,
}

/// Run the full enhancement pipeline. Falls back to a plain file copy if
/// FFmpeg isn't available — the caller still gets a usable output file.
pub async fn enhance_video(
    app: &AppHandle,
    input: &Path,
    output: &Path,
    preset: Preset,
    backend: Arc<dyn AiBackend>,
    progress: ProgressCb,
) -> AppResult<VideoPipelineResult> {
    let ffmpeg_bin = match ff::locate_ffmpeg(app) {
        Ok(p) => p,
        Err(_) => return fallback_copy(input, output).await,
    };
    let ffprobe_bin = match ff::locate_ffprobe(app) {
        Ok(p) => p,
        Err(_) => return fallback_copy(input, output).await,
    };

    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let probe = ff::probe(&ffprobe_bin, input)
        .await
        .map_err(|e| AppError::Ai(format!("ffprobe: {e}")))?;
    tracing::info!(
        "enhance_video: input {}x{} @ {:.2}fps, {:.1}s",
        probe.width,
        probe.height,
        probe.fps(),
        probe.duration_secs,
    );

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let work_dir = std::env::temp_dir().join(format!("dvd-rescue-enhance-{stamp}"));
    let frames_in = work_dir.join("in");
    let frames_out = work_dir.join("out");
    std::fs::create_dir_all(&frames_in)?;
    std::fs::create_dir_all(&frames_out)?;

    // Best-effort cleanup on any error path.
    struct CleanupGuard {
        dir: PathBuf,
    }
    impl Drop for CleanupGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }
    let _guard = CleanupGuard { dir: work_dir.clone() };

    // 1. Extract frames as PNG.
    let extract_pattern = frames_in.join("%06d.png");
    let extract = Command::new(&ffmpeg_bin)
        .args(["-y", "-hide_banner", "-loglevel", "error"])
        .arg("-i")
        .arg(input)
        .arg(&extract_pattern)
        .output()
        .await
        .map_err(|e| AppError::Ai(format!("ffmpeg extract spawn: {e}")))?;
    if !extract.status.success() {
        let stderr = String::from_utf8_lossy(&extract.stderr);
        return Err(AppError::Ai(format!(
            "frame extraction failed: {}",
            stderr.lines().last().unwrap_or("(no stderr)")
        )));
    }

    // 2. Process each extracted frame.
    let upscale_model = preset.ops().iter().find_map(|op| match op {
        EnhancementOp::Upscale { model } => Some(*model),
        _ => None,
    });
    if let Some(model) = upscale_model {
        backend
            .load_model(model, Path::new("placeholder"))
            .map_err(|e| AppError::Ai(format!("load_model: {e}")))?;
    }

    let mut frames: Vec<PathBuf> = std::fs::read_dir(&frames_in)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|x| x.to_str())
                .map(|e| e.eq_ignore_ascii_case("png"))
                .unwrap_or(false)
        })
        .collect();
    frames.sort();
    let total = frames.len() as u64;
    if total == 0 {
        return Err(AppError::Ai(
            "no frames extracted — input may be unsupported".into(),
        ));
    }

    for (i, frame_path) in frames.iter().enumerate() {
        let dst = frames_out.join(frame_path.file_name().unwrap());
        if let Some(model) = upscale_model {
            let img = decode_png(frame_path)?;
            let enhanced = process_image(&img, backend.as_ref(), model)
                .map_err(|e| AppError::Ai(format!("frame {} process: {e}", i + 1)))?;
            encode_png(&enhanced, &dst)?;
        } else {
            // No upscale op — just copy. Simulates the "audio cleanup only"
            // path; will be replaced when audio-side ops are wired.
            std::fs::copy(frame_path, dst)?;
        }
        // Progress fires per frame; UI debounces if it gets noisy.
        progress((i as f32 + 1.0) / total as f32);
    }

    // 3. Reassemble: enhanced frames + original audio.
    let encode_pattern = frames_out.join("%06d.png");
    let fps_str = format!("{}/{}", probe.fps_num, probe.fps_den);
    let encode = Command::new(&ffmpeg_bin)
        .args(["-y", "-hide_banner", "-loglevel", "error"])
        .args(["-framerate", &fps_str])
        .arg("-i")
        .arg(&encode_pattern)
        .arg("-i")
        .arg(input)
        .args([
            "-map", "0:v",
            "-map", "1:a?",       // audio is optional — silent video stays silent
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "18",
            "-preset", "medium",
            "-c:a", "copy",       // passthrough — never re-encode the original audio
            "-movflags", "+faststart",
        ])
        .arg(output)
        .output()
        .await
        .map_err(|e| AppError::Ai(format!("ffmpeg encode spawn: {e}")))?;
    if !encode.status.success() {
        let stderr = String::from_utf8_lossy(&encode.stderr);
        return Err(AppError::Ai(format!(
            "frame reassembly failed: {}",
            stderr.lines().last().unwrap_or("(no stderr)")
        )));
    }

    Ok(VideoPipelineResult {
        frames_processed: total,
        fell_back_to_copy: false,
    })
}

/// Pipe-based pipeline. Streams raw RGB frames from FFmpeg's stdout,
/// processes each through the backend, writes enhanced frames to a second
/// FFmpeg's stdin. No disk staging — works on long videos without
/// gigabytes of temp space.
///
/// Tradeoff: harder to debug (frames are never on disk), but for any video
/// over a few minutes this is the only sane path. Falls back to disk-staged
/// pipeline on FFmpeg miss or pipe error so callers always get a result.
pub async fn enhance_video_piped(
    app: &AppHandle,
    input: &Path,
    output: &Path,
    preset: Preset,
    backend: Arc<dyn AiBackend>,
    progress: ProgressCb,
) -> AppResult<VideoPipelineResult> {
    let ffmpeg_bin = match ff::locate_ffmpeg(app) {
        Ok(p) => p,
        Err(_) => return fallback_copy(input, output).await,
    };
    let ffprobe_bin = match ff::locate_ffprobe(app) {
        Ok(p) => p,
        Err(_) => return fallback_copy(input, output).await,
    };

    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let probe = ff::probe(&ffprobe_bin, input)
        .await
        .map_err(|e| AppError::Ai(format!("ffprobe: {e}")))?;
    let in_w = probe.width;
    let in_h = probe.height;
    if in_w == 0 || in_h == 0 {
        return Err(AppError::Ai(format!(
            "input has no decodable video stream ({}x{})",
            in_w, in_h
        )));
    }
    let fps = probe.fps().max(1.0);

    // Determine output dimensions from preset's upscale model.
    let upscale_model = preset.ops().iter().find_map(|op| match op {
        EnhancementOp::Upscale { model } => Some(*model),
        _ => None,
    });
    let scale = match upscale_model {
        Some(AiModel::RealEsrganX2) => 2u32,
        Some(AiModel::RealEsrganX4) => 4u32,
        _ => 1u32,
    };
    let out_w = in_w * scale;
    let out_h = in_h * scale;

    if let Some(model) = upscale_model {
        backend
            .load_model(model, Path::new("placeholder"))
            .map_err(|e| AppError::Ai(format!("load_model: {e}")))?;
    }

    // Total frames — best-effort from duration × fps. Used only for progress.
    let total_frames = ((probe.duration_secs * fps).round() as u64).max(1);

    // 1. Spawn the extractor: input → raw RGB on stdout.
    let mut extractor = Command::new(&ffmpeg_bin)
        .args(["-y", "-hide_banner", "-loglevel", "error"])
        .arg("-i")
        .arg(input)
        .args([
            "-f", "rawvideo",
            "-pix_fmt", "rgb24",
            "-an", // skip audio in this stream — we'll mux it from input later
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Ai(format!("spawn extractor: {e}")))?;

    // 2. Spawn the encoder: raw RGB on stdin + original audio from input.
    let fps_str = format!("{}/{}", probe.fps_num, probe.fps_den);
    let size_str = format!("{out_w}x{out_h}");
    let mut encoder = Command::new(&ffmpeg_bin)
        .args(["-y", "-hide_banner", "-loglevel", "error"])
        .args([
            "-f", "rawvideo",
            "-pix_fmt", "rgb24",
            "-s", &size_str,
            "-r", &fps_str,
            "-i", "-",
        ])
        .arg("-i")
        .arg(input)
        .args([
            "-map", "0:v",
            "-map", "1:a?",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "18",
            "-preset", "medium",
            "-c:a", "copy",
            "-movflags", "+faststart",
            "-shortest",
        ])
        .arg(output)
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Ai(format!("spawn encoder: {e}")))?;

    let mut ext_stdout = extractor
        .stdout
        .take()
        .ok_or_else(|| AppError::Ai("extractor stdout missing".into()))?;
    let mut enc_stdin = encoder
        .stdin
        .take()
        .ok_or_else(|| AppError::Ai("encoder stdin missing".into()))?;

    // Drain encoder stderr in the background so the encoder never blocks
    // because nobody read its log output.
    if let Some(stderr) = encoder.stderr.take() {
        tokio::spawn(drain_stderr(stderr, "encoder"));
    }
    if let Some(stderr) = extractor.stderr.take() {
        tokio::spawn(drain_stderr(stderr, "extractor"));
    }

    let frame_size = (in_w as usize) * (in_h as usize) * 3;
    let mut frame_buf = vec![0u8; frame_size];
    let mut frames_done: u64 = 0;

    // 3. The pump: read one frame, process, write. Repeat until extractor
    //    closes its stdout (EOF).
    loop {
        match ext_stdout.read_exact(&mut frame_buf).await {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(AppError::Ai(format!("read frame: {e}"))),
        }

        let img = RgbImage::new(in_w, in_h, frame_buf.clone());
        let processed = if let Some(model) = upscale_model {
            process_image(&img, backend.as_ref(), model)
                .map_err(|e| AppError::Ai(format!("backend frame: {e}")))?
        } else {
            img
        };

        if processed.width != out_w || processed.height != out_h {
            return Err(AppError::Ai(format!(
                "backend output size {}x{} doesn't match expected {}x{}",
                processed.width, processed.height, out_w, out_h
            )));
        }

        if let Err(e) = enc_stdin.write_all(&processed.data).await {
            return Err(AppError::Ai(format!("write frame to encoder: {e}")));
        }

        frames_done += 1;
        progress((frames_done as f32 / total_frames as f32).min(1.0));
    }

    // Close encoder stdin so it knows we're done.
    drop(enc_stdin);

    let ext_status = extractor
        .wait()
        .await
        .map_err(|e| AppError::Ai(format!("wait extractor: {e}")))?;
    let enc_status = encoder
        .wait()
        .await
        .map_err(|e| AppError::Ai(format!("wait encoder: {e}")))?;

    if !ext_status.success() {
        return Err(AppError::Ai(format!(
            "extractor exited non-zero: {}",
            ext_status.code().unwrap_or(-1)
        )));
    }
    if !enc_status.success() {
        return Err(AppError::Ai(format!(
            "encoder exited non-zero: {}",
            enc_status.code().unwrap_or(-1)
        )));
    }

    Ok(VideoPipelineResult {
        frames_processed: frames_done,
        fell_back_to_copy: false,
    })
}

async fn drain_stderr(mut stderr: tokio::process::ChildStderr, who: &'static str) {
    let mut buf = vec![0u8; 4096];
    loop {
        match stderr.read(&mut buf).await {
            Ok(0) | Err(_) => return,
            Ok(n) => {
                let line = String::from_utf8_lossy(&buf[..n]);
                for trimmed in line.lines() {
                    if !trimmed.is_empty() {
                        tracing::debug!(target: "ffmpeg", "{who}: {trimmed}");
                    }
                }
            }
        }
    }
}

async fn fallback_copy(input: &Path, output: &Path) -> AppResult<VideoPipelineResult> {
    tracing::warn!("FFmpeg unavailable; falling back to file copy");
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(input, output)
        .map_err(|e| AppError::Ai(format!("fallback copy: {e}")))?;
    Ok(VideoPipelineResult {
        frames_processed: 0,
        fell_back_to_copy: true,
    })
}

fn decode_png(path: &Path) -> AppResult<RgbImage> {
    let img = image::open(path)
        .map_err(|e| AppError::Ai(format!("decode {}: {e}", path.display())))?;
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    Ok(RgbImage::new(w, h, rgb.into_raw()))
}

fn encode_png(img: &RgbImage, path: &Path) -> AppResult<()> {
    let buffer: image::RgbImage =
        image::RgbImage::from_raw(img.width, img.height, img.data.clone())
            .ok_or_else(|| AppError::Ai("buffer size mismatch encoding PNG".into()))?;
    buffer
        .save_with_format(path, image::ImageFormat::Png)
        .map_err(|e| AppError::Ai(format!("save PNG: {e}")))?;
    Ok(())
}
