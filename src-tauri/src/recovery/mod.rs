//! Recovery engine — sector map, multi-pass scheduler, retry logic.

pub mod engine;
pub mod health;
pub mod map;
pub mod passes;
pub mod rmap;

pub use engine::{RecoveryEngine, RecoveryProgress, RecoveryStats};
pub use map::{SectorMap, SectorState};
pub use passes::{PassStrategy, RecoveryPass};
