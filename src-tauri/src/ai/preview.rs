//! Single-frame "before / after" preview generator.
//!
//! Workflow per `docs/ai-restoration.md`:
//! > Sample on a 30-second clip first; let user approve before processing
//! > 2 hours.
//!
//! This is the smaller version: pick one frame at a chosen timestamp, run
//! it through the AI pipeline, save before+after as PNG so the UI can show
//! a side-by-side viewer.
//!
//! Uses FFmpeg as a subprocess (the project's bundled binary). The pipeline
//! never holds an entire video in memory — extracts → process → save.

use crate::ai::backend::AiBackend;
use crate::ai::models::AiModel;
use crate::ai::pipeline::{EnhancementOp, Preset};
use crate::ai::tiling::{process_image, RgbImage};
use crate::error::{AppError, AppResult};
use crate::media::ffmpeg as ff;
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::process::Command;

#[derive(Debug, Serialize)]
pub struct PreviewResult {
    pub original_png_path: String,
    pub enhanced_png_path: String,
    pub original_width: u32,
    pub original_height: u32,
    pub enhanced_width: u32,
    pub enhanced_height: u32,
    pub backend_name: String,
    pub upscale_factor: f32,
}

/// Generate a before/after preview for a single frame.
///
/// `timestamp_secs` is the position in the input video to sample (e.g. 5.0
/// for 5 seconds in). Output PNGs land in the OS temp dir with a unique
/// timestamp prefix; the caller can show them and clean up later.
pub async fn generate(
    app: &AppHandle,
    input: &Path,
    timestamp_secs: f32,
    preset: Preset,
    backend: Arc<dyn AiBackend>,
) -> AppResult<PreviewResult> {
    let ffmpeg_bin = ff::locate_ffmpeg(app)?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let preview_dir = std::env::temp_dir().join(format!("dvd-rescue-preview-{stamp}"));
    std::fs::create_dir_all(&preview_dir)?;
    let original_path = preview_dir.join("original.png");
    let enhanced_path = preview_dir.join("enhanced.png");

    // 1. Extract a single frame at the requested timestamp as PNG.
    extract_frame(&ffmpeg_bin, input, timestamp_secs, &original_path).await?;

    // 2. Decode the PNG into our RgbImage type.
    let img = decode_png(&original_path)?;
    let orig_w = img.width;
    let orig_h = img.height;

    // 3. Pick the upscale model from the preset (the one that actually
    //    changes pixel dimensions). If the preset has no upscale op, the
    //    enhanced output is identical to the original.
    let upscale_model = preset.ops().iter().find_map(|op| match op {
        EnhancementOp::Upscale { model } => Some(*model),
        _ => None,
    });

    let enhanced = if let Some(model) = upscale_model {
        // The mock backend doesn't read the file but still wants a path.
        // For a real ONNX backend, route through the model catalog.
        backend
            .load_model(model, Path::new("placeholder"))
            .map_err(|e| AppError::Ai(format!("load_model: {e}")))?;
        process_image(&img, backend.as_ref(), model)
            .map_err(|e| AppError::Ai(format!("process_image: {e}")))?
    } else {
        img.clone()
    };

    let enh_w = enhanced.width;
    let enh_h = enhanced.height;
    encode_png(&enhanced, &enhanced_path)?;

    let info = backend.info();
    let upscale_factor = match upscale_model {
        Some(AiModel::RealEsrganX2) => 2.0,
        Some(AiModel::RealEsrganX4) => 4.0,
        Some(_) => 1.0,
        None => 1.0,
    };

    Ok(PreviewResult {
        original_png_path: original_path.to_string_lossy().to_string(),
        enhanced_png_path: enhanced_path.to_string_lossy().to_string(),
        original_width: orig_w,
        original_height: orig_h,
        enhanced_width: enh_w,
        enhanced_height: enh_h,
        backend_name: info.name.to_string(),
        upscale_factor,
    })
}

async fn extract_frame(
    ffmpeg_bin: &Path,
    input: &Path,
    timestamp_secs: f32,
    output: &Path,
) -> AppResult<()> {
    // -ss before -i is "fast seek" — accurate enough for previews and orders
    // of magnitude faster than -ss after -i on long videos.
    let result = Command::new(ffmpeg_bin)
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            &format!("{timestamp_secs}"),
        ])
        .arg("-i")
        .arg(input)
        .args(["-frames:v", "1", "-vsync", "0"])
        .arg(output)
        .output()
        .await
        .map_err(|e| AppError::Media(format!("spawn ffmpeg: {e}")))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(AppError::Media(format!(
            "ffmpeg frame extract failed: {}",
            stderr.lines().last().unwrap_or("(no stderr)")
        )));
    }
    Ok(())
}

fn decode_png(path: &Path) -> AppResult<RgbImage> {
    let img = image::open(path)
        .map_err(|e| AppError::Ai(format!("decode {}: {e}", path.display())))?;
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    Ok(RgbImage::new(w, h, rgb.into_raw()))
}

fn encode_png(img: &RgbImage, path: &Path) -> AppResult<()> {
    let buffer: image::RgbImage = image::RgbImage::from_raw(img.width, img.height, img.data.clone())
        .ok_or_else(|| AppError::Ai("buffer size mismatch encoding PNG".into()))?;
    buffer
        .save_with_format(path, image::ImageFormat::Png)
        .map_err(|e| AppError::Ai(format!("save PNG: {e}")))?;
    Ok(())
}

/// Cleanup helper for callers — removes a previously generated preview dir.
#[allow(dead_code)]
pub fn cleanup(result: &PreviewResult) {
    if let Some(parent) = std::path::Path::new(&result.original_png_path).parent() {
        let _ = std::fs::remove_dir_all(parent);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::tiling::RgbImage;

    #[test]
    fn png_encode_decode_roundtrip() {
        let mut data = Vec::with_capacity(40 * 30 * 3);
        for y in 0..30u32 {
            for x in 0..40u32 {
                data.extend_from_slice(&[
                    (x % 256) as u8,
                    (y % 256) as u8,
                    ((x ^ y) % 256) as u8,
                ]);
            }
        }
        let img = RgbImage::new(40, 30, data);
        let tmp = std::env::temp_dir().join(format!(
            "dvd-rescue-png-test-{}.png",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        encode_png(&img, &tmp).unwrap();
        let decoded = decode_png(&tmp).unwrap();
        let _ = std::fs::remove_file(&tmp);
        assert_eq!(decoded.width, 40);
        assert_eq!(decoded.height, 30);
        assert_eq!(decoded.data, img.data);
    }
}
