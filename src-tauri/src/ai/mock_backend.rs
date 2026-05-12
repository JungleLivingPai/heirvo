//! In-process backend that lets us exercise the full job pipeline without a
//! real ONNX runtime. Returns the input tile unchanged (or upscaled by 2×
//! via simple pixel duplication for `RealEsrganX2`/`RealEsrganX4`).
//!
//! Used by:
//! - Unit tests of the job lifecycle
//! - Dev mode when no GPU/ONNX is available — the user sees the pipeline
//!   work end-to-end so we can validate UX, even though the output isn't
//!   actually enhanced

use crate::ai::backend::{AiBackend, BackendInfo, BackendResult, Tile, TileLayout};
use crate::ai::models::AiModel;
use parking_lot::Mutex;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Default)]
pub struct MockAiBackend {
    loaded: Mutex<HashSet<AiModel>>,
    /// Track loaded paths so tests can assert load_model was called.
    last_paths: Mutex<Vec<PathBuf>>,
}

impl MockAiBackend {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn loaded_count(&self) -> usize {
        self.loaded.lock().len()
    }

    pub fn last_loaded_paths(&self) -> Vec<PathBuf> {
        self.last_paths.lock().clone()
    }
}

impl AiBackend for MockAiBackend {
    fn info(&self) -> BackendInfo {
        BackendInfo {
            name: "mock",
            device: "CPU (mock)".into(),
            tile_layout: TileLayout::Rgb,
            max_tile_size: 512,
        }
    }

    fn load_model(&self, model: AiModel, path: &Path) -> BackendResult<()> {
        // Pretend the model file exists; tests can opt-in to "missing file"
        // checks by writing nothing to disk and using `OnnxBackend` instead.
        self.loaded.lock().insert(model);
        self.last_paths.lock().push(path.to_path_buf());
        Ok(())
    }

    fn run(&self, model: AiModel, input: &Tile) -> BackendResult<Tile> {
        if !self.loaded.lock().contains(&model) {
            return Err(crate::ai::backend::BackendError::ModelNotLoaded(model));
        }
        if input.width == 0 || input.height == 0 {
            return Err(crate::ai::backend::BackendError::InvalidTile(
                input.width,
                input.height,
            ));
        }
        // Simulate the upscale factor of the model. RealEsrganX2 produces
        // a 2× image; X4 produces 4×; everything else returns the input
        // unchanged. Pixel duplication is intentionally crude — this is a
        // mock for pipeline plumbing, not an image-quality reference.
        let scale = match model {
            AiModel::RealEsrganX2 | AiModel::Rife4 | AiModel::BasicVsr => 2,
            AiModel::RealEsrganX4 => 4,
            AiModel::DeepFilterNet => 1,
        };
        if scale == 1 {
            return Ok(input.clone());
        }
        let out_w = input.width * scale;
        let out_h = input.height * scale;
        let out_w_us = out_w as usize;
        let out_h_us = out_h as usize;
        let in_w = input.width as usize;
        let bytes_per_px = 3; // Rgb
        let mut out = vec![0u8; out_w_us * out_h_us * bytes_per_px];
        let scale_us = scale as usize;
        for y in 0..out_h_us {
            for x in 0..out_w_us {
                let src_x = x / scale_us;
                let src_y = y / scale_us;
                let src_off = (src_y * in_w + src_x) * bytes_per_px;
                let dst_off = (y * out_w_us + x) * bytes_per_px;
                out[dst_off..dst_off + bytes_per_px]
                    .copy_from_slice(&input.data[src_off..src_off + bytes_per_px]);
            }
        }
        Ok(Tile {
            width: out_w,
            height: out_h,
            data: out,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::backend::BackendError;

    fn rgb_tile(w: u32, h: u32, fill: u8) -> Tile {
        Tile {
            width: w,
            height: h,
            data: vec![fill; (w * h * 3) as usize],
        }
    }

    #[test]
    fn run_without_load_returns_error() {
        let b = MockAiBackend::new();
        let err = b.run(AiModel::RealEsrganX2, &rgb_tile(8, 8, 0)).unwrap_err();
        matches!(err, BackendError::ModelNotLoaded(_));
    }

    #[test]
    fn x2_doubles_dimensions() {
        let b = MockAiBackend::new();
        b.load_model(AiModel::RealEsrganX2, std::path::Path::new("/dev/null"))
            .unwrap();
        let out = b.run(AiModel::RealEsrganX2, &rgb_tile(8, 4, 7)).unwrap();
        assert_eq!(out.width, 16);
        assert_eq!(out.height, 8);
        // First pixel should be the same fill value (pixel-duplicating).
        assert_eq!(out.data[0], 7);
        assert_eq!(out.data.len(), 16 * 8 * 3);
    }

    #[test]
    fn x4_quadruples_dimensions() {
        let b = MockAiBackend::new();
        b.load_model(AiModel::RealEsrganX4, std::path::Path::new("/dev/null"))
            .unwrap();
        let out = b.run(AiModel::RealEsrganX4, &rgb_tile(4, 4, 0xAA)).unwrap();
        assert_eq!(out.width, 16);
        assert_eq!(out.height, 16);
    }

    #[test]
    fn audio_model_returns_input_unchanged() {
        let b = MockAiBackend::new();
        b.load_model(AiModel::DeepFilterNet, std::path::Path::new("/dev/null"))
            .unwrap();
        let input = rgb_tile(8, 8, 5);
        let out = b.run(AiModel::DeepFilterNet, &input).unwrap();
        assert_eq!(out.width, input.width);
        assert_eq!(out.height, input.height);
    }

    #[test]
    fn invalid_tile_dimensions_rejected() {
        let b = MockAiBackend::new();
        b.load_model(AiModel::RealEsrganX2, std::path::Path::new("/dev/null"))
            .unwrap();
        let bad = Tile {
            width: 0,
            height: 8,
            data: vec![],
        };
        let err = b.run(AiModel::RealEsrganX2, &bad).unwrap_err();
        matches!(err, BackendError::InvalidTile(_, _));
    }

    #[test]
    fn load_model_tracks_paths() {
        let b = MockAiBackend::new();
        b.load_model(AiModel::RealEsrganX2, std::path::Path::new("/a/x2"))
            .unwrap();
        b.load_model(AiModel::Rife4, std::path::Path::new("/b/rife"))
            .unwrap();
        assert_eq!(b.loaded_count(), 2);
        let paths = b.last_loaded_paths();
        assert_eq!(paths.len(), 2);
    }
}
