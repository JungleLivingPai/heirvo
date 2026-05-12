//! Real ONNX Runtime backend with DirectML execution provider.
//!
//! Only compiled when the `onnx` Cargo feature is enabled. Without it the
//! crate stays light and the app uses `MockAiBackend`. The trait surface is
//! identical so the rest of the pipeline doesn't care.
//!
//! ## Notes on `ort` 2.x
//!
//! - We use `load-dynamic` so the ONNX Runtime DLL is loaded at runtime
//!   (rather than statically linked). Lets us ship the DLL alongside the
//!   exe without it being part of the Rust artifact.
//! - DirectML is the cross-vendor Windows GPU EP — works on NVIDIA, AMD,
//!   Intel. CPU fallback is always installed last.
//! - Sessions are cached per-model in a `RwLock<HashMap>` so re-using a
//!   model doesn't re-load weights.

#![cfg(feature = "onnx")]

use crate::ai::backend::{AiBackend, BackendError, BackendInfo, BackendResult, Tile, TileLayout};
use crate::ai::models::AiModel;
use ndarray::Array4;
use ort::execution_providers::{CPUExecutionProvider, DirectMLExecutionProvider};
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use parking_lot::{Mutex, RwLock};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

pub struct OnnxBackend {
    /// Each session wrapped in a Mutex because ort 2.0-rc.12 requires
    /// &mut Session for `run()`. Mutex serializes inferences per-model,
    /// which is fine: GPU is single-threaded anyway.
    sessions: RwLock<HashMap<AiModel, Arc<Mutex<Session>>>>,
    /// Cached info — once we've successfully created any session we know
    /// which device DirectML picked.
    device_label: RwLock<String>,
}

impl Default for OnnxBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl OnnxBackend {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            device_label: RwLock::new("DirectML / CPU".into()),
        }
    }

    fn build_session(path: &Path) -> BackendResult<Session> {
        Session::builder()
            .map_err(|e| BackendError::Inference(format!("Session::builder: {e}")))?
            .with_execution_providers([
                DirectMLExecutionProvider::default().build(),
                CPUExecutionProvider::default().build(),
            ])
            .map_err(|e| BackendError::Inference(format!("with_execution_providers: {e}")))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| BackendError::Inference(format!("with_optimization_level: {e}")))?
            .commit_from_file(path)
            .map_err(|e| BackendError::Inference(format!("commit_from_file: {e}")))
    }
}

impl AiBackend for OnnxBackend {
    fn info(&self) -> BackendInfo {
        BackendInfo {
            name: "onnx-directml",
            device: self.device_label.read().clone(),
            tile_layout: TileLayout::Rgb,
            // Most Real-ESRGAN ONNX exports want square tile inputs that
            // are multiples of 8. 256 leaves headroom for 4× upscale on
            // 6GB GPUs without OOM. Tunable later per-model.
            max_tile_size: 256,
        }
    }

    fn load_model(&self, model: AiModel, path: &Path) -> BackendResult<()> {
        if !path.is_file() {
            return Err(BackendError::ModelFileMissing(path.display().to_string()));
        }
        if self.sessions.read().contains_key(&model) {
            return Ok(());
        }
        let session = Self::build_session(path)?;
        self.sessions.write().insert(model, Arc::new(Mutex::new(session)));
        Ok(())
    }

    fn run(&self, model: AiModel, input: &Tile) -> BackendResult<Tile> {
        if input.width == 0 || input.height == 0 {
            return Err(BackendError::InvalidTile(input.width, input.height));
        }
        let session_arc = self
            .sessions
            .read()
            .get(&model)
            .cloned()
            .ok_or(BackendError::ModelNotLoaded(model))?;
        let mut session = session_arc.lock();

        // Convert RGB u8 [HWC] → f32 NCHW in [0,1].
        let h = input.height as usize;
        let w = input.width as usize;
        let mut chw = vec![0f32; 3 * h * w];
        for y in 0..h {
            for x in 0..w {
                let src_off = (y * w + x) * 3;
                let r = input.data[src_off] as f32 / 255.0;
                let g = input.data[src_off + 1] as f32 / 255.0;
                let b = input.data[src_off + 2] as f32 / 255.0;
                chw[0 * h * w + y * w + x] = r;
                chw[1 * h * w + y * w + x] = g;
                chw[2 * h * w + y * w + x] = b;
            }
        }
        let tensor = Array4::from_shape_vec((1, 3, h, w), chw)
            .map_err(|e| BackendError::Inference(format!("array shape: {e}")))?;
        let input_tensor = Tensor::from_array(tensor)
            .map_err(|e| BackendError::Inference(format!("Tensor::from_array: {e}")))?;

        let outputs = session
            .run(ort::inputs![input_tensor])
            .map_err(|e| BackendError::Inference(format!("session.run: {e}")))?;

        // Most super-resolution models have a single output — grab the first.
        let (_, output_tensor) = outputs
            .iter()
            .next()
            .ok_or_else(|| BackendError::Inference("no output tensors".into()))?;
        let output_view = output_tensor
            .try_extract_array::<f32>()
            .map_err(|e| BackendError::Inference(format!("extract output: {e}")))?;

        // Output is NCHW. Read shape, then convert back to HWC u8.
        let shape = output_view.shape();
        if shape.len() != 4 || shape[0] != 1 || shape[1] != 3 {
            return Err(BackendError::Inference(format!(
                "unexpected output shape {shape:?}; expected [1, 3, H, W]"
            )));
        }
        let out_h = shape[2];
        let out_w = shape[3];
        let mut rgb = vec![0u8; out_h * out_w * 3];
        let plane_size = out_h * out_w;
        let flat = output_view
            .as_standard_layout()
            .into_owned()
            .into_raw_vec_and_offset()
            .0;
        for y in 0..out_h {
            for x in 0..out_w {
                let dst_off = (y * out_w + x) * 3;
                let r = (flat[0 * plane_size + y * out_w + x].clamp(0.0, 1.0) * 255.0) as u8;
                let g = (flat[1 * plane_size + y * out_w + x].clamp(0.0, 1.0) * 255.0) as u8;
                let b = (flat[2 * plane_size + y * out_w + x].clamp(0.0, 1.0) * 255.0) as u8;
                rgb[dst_off] = r;
                rgb[dst_off + 1] = g;
                rgb[dst_off + 2] = b;
            }
        }

        Ok(Tile {
            width: out_w as u32,
            height: out_h as u32,
            data: rgb,
        })
    }

    fn available(&self) -> bool {
        // Best-effort: try to construct a Session::builder. If `ort` can't
        // load its native lib at all, this errors out cleanly and we report
        // unavailable so the UI can fall back to mock + show a hint.
        Session::builder().is_ok()
    }
}
