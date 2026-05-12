//! Enhancement pipeline definition and orchestration.

use crate::ai::backend::AiBackend;
use crate::ai::models::AiModel;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EnhancementOp {
    Deinterlace,
    Denoise,
    Upscale { model: AiModel },
    InterpolateFrames { model: AiModel, target_fps: u32 },
    AudioCleanup { model: AiModel },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementJob {
    pub input: PathBuf,
    pub output: PathBuf,
    pub ops: Vec<EnhancementOp>,
}

/// Three preset levels per docs/ai-restoration.md — no expert sliders.
/// Light is the default and the safest.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Preset {
    Light,
    Standard,
    Maximum,
}

impl Preset {
    /// Build the default op list for this preset.
    pub fn ops(&self) -> Vec<EnhancementOp> {
        match self {
            Preset::Light => vec![
                EnhancementOp::Deinterlace,
                EnhancementOp::Denoise,
                EnhancementOp::Upscale {
                    model: AiModel::RealEsrganX2,
                },
            ],
            Preset::Standard => vec![
                EnhancementOp::Deinterlace,
                EnhancementOp::Denoise,
                EnhancementOp::Upscale {
                    model: AiModel::RealEsrganX2,
                },
                EnhancementOp::AudioCleanup {
                    model: AiModel::DeepFilterNet,
                },
            ],
            Preset::Maximum => vec![
                EnhancementOp::Deinterlace,
                EnhancementOp::Denoise,
                EnhancementOp::Upscale {
                    model: AiModel::RealEsrganX2,
                },
                EnhancementOp::InterpolateFrames {
                    model: AiModel::Rife4,
                    target_fps: 60,
                },
                EnhancementOp::AudioCleanup {
                    model: AiModel::DeepFilterNet,
                },
            ],
        }
    }
}

/// Pick the active inference backend. With the `onnx` Cargo feature enabled,
/// returns an `OnnxBackend` (DirectML + CPU fallback). Otherwise — and as a
/// safe fallback when the ONNX runtime DLL can't be loaded — returns the
/// mock backend so the rest of the pipeline still works.
pub fn default_backend() -> Arc<dyn AiBackend> {
    #[cfg(feature = "onnx")]
    {
        let onnx = crate::ai::onnx_backend::OnnxBackend::new();
        if onnx.available() {
            return Arc::new(onnx);
        }
        tracing::warn!("ONNX backend unavailable; falling back to mock");
    }
    Arc::new(crate::ai::mock_backend::MockAiBackend::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn light_preset_is_safe_default() {
        let ops = Preset::Light.ops();
        // Light should be deinterlace + denoise + 2x upscale — three ops, no
        // experimental work like frame interpolation.
        assert_eq!(ops.len(), 3);
        assert!(ops.contains(&EnhancementOp::Deinterlace));
        assert!(ops.contains(&EnhancementOp::Denoise));
        assert!(matches!(
            ops[2],
            EnhancementOp::Upscale {
                model: AiModel::RealEsrganX2
            }
        ));
    }

    #[test]
    fn maximum_preset_includes_frame_interpolation() {
        let ops = Preset::Maximum.ops();
        assert!(ops.iter().any(|op| matches!(
            op,
            EnhancementOp::InterpolateFrames {
                model: AiModel::Rife4,
                target_fps: 60
            }
        )));
    }

    #[test]
    fn preset_ops_serialize_roundtrip() {
        for preset in [Preset::Light, Preset::Standard, Preset::Maximum] {
            let ops = preset.ops();
            let json = serde_json::to_string(&ops).unwrap();
            let back: Vec<EnhancementOp> = serde_json::from_str(&json).unwrap();
            assert_eq!(back, ops);
        }
    }
}
