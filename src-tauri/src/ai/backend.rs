//! Backend abstraction for AI inference.
//!
//! Real production backend will be ONNX Runtime + DirectML execution provider
//! (works on NVIDIA, AMD, Intel — beats Topaz which is NVIDIA-favored). The
//! `AiBackend` trait isolates that integration so the rest of the pipeline
//! (job lifecycle, frame extraction, progress reporting) can be built and
//! tested without the 50MB native dependency.
//!
//! Concrete implementations:
//! - `MockAiBackend` — returns input unchanged; lets us validate the dispatch
//!   pipeline end-to-end in unit tests
//! - `OnnxBackend` (stub for now) — wraps `ort`/DirectML once added
//!
//! ## Tile-based dispatch
//!
//! Real-ESRGAN and similar models can't process a 1920×1080 frame in one
//! pass on a 6GB GPU. The contract here is "input is one tile" — typically
//! 512×512 with a 32px overlap. The pipeline above splits + stitches.

use crate::ai::models::AiModel;
use serde::Serialize;

/// A single image tile in BGRA or RGB layout (caller's choice; backend
/// reports its expected layout via `BackendInfo::tile_layout`).
#[derive(Debug, Clone)]
pub struct Tile {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TileLayout {
    /// 4 bytes/pixel: B, G, R, A.
    Bgra,
    /// 3 bytes/pixel: R, G, B.
    Rgb,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackendInfo {
    pub name: &'static str,
    pub device: String,
    pub tile_layout: TileLayout,
    pub max_tile_size: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum BackendError {
    #[error("model not loaded: {0:?}")]
    ModelNotLoaded(AiModel),

    #[error("model file not found: {0}")]
    ModelFileMissing(String),

    #[error("backend not available: {0}")]
    Unavailable(String),

    #[error("inference failed: {0}")]
    Inference(String),

    #[error("invalid tile dimensions: {0}x{1}")]
    InvalidTile(u32, u32),
}

pub type BackendResult<T> = Result<T, BackendError>;

/// Implemented by every inference backend.
pub trait AiBackend: Send + Sync {
    /// Backend identification + capabilities. Stable for the life of the
    /// instance.
    fn info(&self) -> BackendInfo;

    /// Load model weights from disk. Idempotent — safe to call repeatedly
    /// for the same model.
    fn load_model(&self, model: AiModel, path: &std::path::Path) -> BackendResult<()>;

    /// Run inference on a single tile. The output tile may be larger than
    /// the input (e.g. Real-ESRGAN x2 produces 2× the input dimensions).
    fn run(&self, model: AiModel, input: &Tile) -> BackendResult<Tile>;

    /// True if this backend is available on the current machine. False if
    /// e.g. the GPU isn't supported or the runtime DLL is missing.
    fn available(&self) -> bool {
        true
    }
}
