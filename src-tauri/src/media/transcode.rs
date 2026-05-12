//! FFmpeg-based transcoding to modern container formats.
//!
//! Builds a complete `ffmpeg` argument list from a `TranscodeJob` and runs it
//! with progress event streaming.

use crate::error::{AppError, AppResult};
use crate::media::ffmpeg::{self, FfmpegProgress};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputCodec {
    H264,
    H265,
    Av1,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QualityPreset {
    Archive,
    HighQuality,
    Streaming,
    Mobile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeJob {
    pub input: PathBuf,
    pub output: PathBuf,
    pub codec: OutputCodec,
    pub quality: QualityPreset,
    pub deinterlace: bool,
    pub denoise: bool,
    /// Optional resolution override (width, height). Defaults to source.
    pub resolution: Option<(u32, u32)>,
}

impl TranscodeJob {
    /// Build the full argument list for ffmpeg.
    pub fn to_args(&self) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "-y".into(),
            "-hide_banner".into(),
            "-i".into(),
            self.input.to_string_lossy().to_string(),
        ];

        // Build a video filter chain.
        let mut filters: Vec<String> = Vec::new();
        if self.deinterlace {
            // bwdif = bilateral motion-adaptive deinterlacer; better quality than yadif.
            filters.push("bwdif=mode=send_frame:parity=auto".into());
        }
        if self.denoise {
            filters.push("hqdn3d=4:3:6:4.5".into());
        }
        if let Some((w, h)) = self.resolution {
            filters.push(format!("scale={w}:{h}:flags=lanczos"));
        }
        if !filters.is_empty() {
            args.push("-vf".into());
            args.push(filters.join(","));
        }

        // Codec + quality.
        let (vcodec, crf) = match (self.codec, self.quality) {
            (OutputCodec::H264, QualityPreset::Archive) => ("libx264", 14),
            (OutputCodec::H264, QualityPreset::HighQuality) => ("libx264", 18),
            (OutputCodec::H264, QualityPreset::Streaming) => ("libx264", 23),
            (OutputCodec::H264, QualityPreset::Mobile) => ("libx264", 26),
            (OutputCodec::H265, QualityPreset::Archive) => ("libx265", 16),
            (OutputCodec::H265, QualityPreset::HighQuality) => ("libx265", 20),
            (OutputCodec::H265, QualityPreset::Streaming) => ("libx265", 24),
            (OutputCodec::H265, QualityPreset::Mobile) => ("libx265", 28),
            (OutputCodec::Av1, QualityPreset::Archive) => ("libsvtav1", 22),
            (OutputCodec::Av1, QualityPreset::HighQuality) => ("libsvtav1", 28),
            (OutputCodec::Av1, QualityPreset::Streaming) => ("libsvtav1", 34),
            (OutputCodec::Av1, QualityPreset::Mobile) => ("libsvtav1", 38),
        };

        args.extend([
            "-c:v".into(),
            vcodec.into(),
            "-crf".into(),
            crf.to_string(),
            "-preset".into(),
            "medium".into(),
            "-pix_fmt".into(),
            "yuv420p".into(),
        ]);

        // Audio: default re-encode to AAC 192kbps for broad compatibility.
        args.extend([
            "-c:a".into(),
            "aac".into(),
            "-b:a".into(),
            "192k".into(),
            "-ac".into(),
            "2".into(),
        ]);

        // Container: pick from output extension. Default mp4.
        args.extend(["-movflags".into(), "+faststart".into()]);

        args.push(self.output.to_string_lossy().to_string());
        args
    }
}

pub async fn run(
    app: &AppHandle,
    job: TranscodeJob,
    on_progress: Arc<dyn Fn(FfmpegProgress) + Send + Sync>,
    cancel: Option<tokio::sync::watch::Receiver<bool>>,
) -> AppResult<()> {
    let bin = ffmpeg::locate_ffmpeg(app)?;
    if let Some(parent) = job.output.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Media(format!("create output dir: {e}")))?;
    }
    ffmpeg::run_with_progress(&bin, &job.to_args(), on_progress, cancel).await
}
