//! AI enhancement pipeline.
//!
//! Production target: ONNX Runtime + DirectML execution provider on Windows
//! (works on NVIDIA, AMD, Intel — beats Topaz which is NVIDIA-favored).
//!
//! ## Architecture
//!
//! ```text
//!  ┌─────────────────┐
//!  │ EnhancementJob  │ ← user picks input file, presets, ops
//!  └────────┬────────┘
//!           ▼
//!  ┌─────────────────┐
//!  │  jobs (SQLite)  │ ← persisted lifecycle: queued → running → done
//!  └────────┬────────┘
//!           ▼
//!  ┌─────────────────┐    ┌────────────┐
//!  │   pipeline.rs   │───▶│ AiBackend  │ ← MockAiBackend now,
//!  │ (orchestrator)  │    │   trait    │   OnnxBackend later
//!  └─────────────────┘    └────────────┘
//! ```
//!
//! The trait split lets us build + ship the dispatch infrastructure
//! independently of the (~50MB) ort native dependency.
//!
//! ## TODO: real ONNX backend
//!
//! 1. Add `ort = { version = "2", features = ["directml"] }` to Cargo.toml
//! 2. New `ai/onnx_backend.rs` implementing `AiBackend`
//! 3. Switch `default_backend()` in `pipeline.rs` based on `--features` flag

pub mod backend;
pub mod jobs;
pub mod mock_backend;
pub mod model_downloader;
pub mod models;
#[cfg(feature = "onnx")]
pub mod onnx_backend;
pub mod pipeline;
pub mod preview;
pub mod tiling;
pub mod video_pipeline;

pub use backend::{AiBackend, BackendError, BackendInfo, BackendResult, Tile, TileLayout};
pub use jobs::{JobRecord, JobStatus};
pub use mock_backend::MockAiBackend;
pub use models::{AiModel, ModelCatalog};
pub use pipeline::{EnhancementJob, EnhancementOp};
