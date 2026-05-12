//! AI model catalog. Tracks which models are available locally, where they
//! live on disk, and (when known) where to download them from.
//!
//! Models live under `<app_data_dir>/models/<model_id>.onnx`. The downloader
//! ([`crate::ai::model_downloader`]) streams + verifies them on demand; users
//! can also drop their own ONNX files in that directory manually.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AiModel {
    RealEsrganX2,
    RealEsrganX4,
    Rife4,
    DeepFilterNet,
    BasicVsr,
}

impl AiModel {
    pub fn id(&self) -> &'static str {
        match self {
            AiModel::RealEsrganX2 => "realesrgan-x2plus",
            AiModel::RealEsrganX4 => "realesrgan-x4plus",
            AiModel::Rife4 => "rife-v4",
            AiModel::DeepFilterNet => "deepfilternet-3",
            AiModel::BasicVsr => "basicvsr-pp",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            AiModel::RealEsrganX2 => "2x video upscaling",
            AiModel::RealEsrganX4 => "4x video upscaling",
            AiModel::Rife4 => "Frame interpolation",
            AiModel::DeepFilterNet => "Audio noise removal",
            AiModel::BasicVsr => "Temporal video super-resolution",
        }
    }

    /// Approximate ONNX export size in MB. Used for the UI to give users a
    /// "this download will take ~30s on a typical connection" feel before
    /// they commit.
    pub fn approx_size_mb(&self) -> u32 {
        match self {
            AiModel::RealEsrganX2 => 64,
            AiModel::RealEsrganX4 => 67,
            AiModel::Rife4 => 38,
            AiModel::DeepFilterNet => 14,
            AiModel::BasicVsr => 195,
        }
    }

    /// Canonical download URL for the ONNX export. `None` when the model
    /// has no canonical mirror yet — users can still install it manually.
    ///
    /// Note: these are placeholders until we host mirrors. Real shipping
    /// builds should pin to a hash-verified, version-controlled URL.
    pub fn download_url(&self) -> Option<&'static str> {
        // Intentionally `None` for now. Adding URLs is a focused follow-up
        // (and a release-time content-hosting decision). The downloader
        // infrastructure works for any URL we plug in here.
        None
    }

    /// SHA-256 of the canonical ONNX file, if known. Used by the downloader
    /// to verify integrity. `None` when no canonical hash is pinned.
    pub fn expected_sha256(&self) -> Option<&'static str> {
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCatalog {
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub model: AiModel,
    pub installed: bool,
    pub path: Option<String>,
    pub size_mb: u32,
    pub download_url: Option<String>,
    pub has_pinned_hash: bool,
    pub description: String,
}

/// Static fallback used when the app can't resolve an `app_data_dir` (very
/// rare). Marks everything as "not installed" but otherwise complete.
pub fn default_catalog() -> ModelCatalog {
    let all = [
        AiModel::RealEsrganX2,
        AiModel::RealEsrganX4,
        AiModel::Rife4,
        AiModel::DeepFilterNet,
        AiModel::BasicVsr,
    ];
    ModelCatalog {
        models: all
            .iter()
            .map(|m| ModelEntry {
                model: *m,
                installed: false,
                path: None,
                size_mb: m.approx_size_mb(),
                download_url: m.download_url().map(str::to_string),
                has_pinned_hash: m.expected_sha256().is_some(),
                description: m.description().to_string(),
            })
            .collect(),
    }
}

/// Build the catalog with installation status against an actual data
/// directory on disk. Called from the IPC handler.
pub fn catalog_for(app_data_dir: &Path) -> ModelCatalog {
    let dir = app_data_dir.join("models");
    let all = [
        AiModel::RealEsrganX2,
        AiModel::RealEsrganX4,
        AiModel::Rife4,
        AiModel::DeepFilterNet,
        AiModel::BasicVsr,
    ];
    ModelCatalog {
        models: all
            .iter()
            .map(|m| {
                let path = dir.join(format!("{}.onnx", m.id()));
                let installed = path.is_file();
                ModelEntry {
                    model: *m,
                    installed,
                    path: if installed {
                        Some(path.to_string_lossy().to_string())
                    } else {
                        None
                    },
                    size_mb: m.approx_size_mb(),
                    download_url: m.download_url().map(str::to_string),
                    has_pinned_hash: m.expected_sha256().is_some(),
                    description: m.description().to_string(),
                }
            })
            .collect(),
    }
}

/// Resolve the on-disk location for a model file (whether or not it
/// currently exists).
pub fn model_path(app_data_dir: &Path, model: AiModel) -> PathBuf {
    app_data_dir.join("models").join(format!("{}.onnx", model.id()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_marks_installed_when_file_exists() {
        let tmp = std::env::temp_dir().join(format!(
            "dvd-rescue-catalog-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let models = tmp.join("models");
        std::fs::create_dir_all(&models).unwrap();
        // Drop a fake ONNX file for one model.
        let path = models.join(format!("{}.onnx", AiModel::RealEsrganX2.id()));
        std::fs::write(&path, b"fake onnx bytes").unwrap();

        let cat = catalog_for(&tmp);
        let installed: Vec<_> = cat
            .models
            .iter()
            .filter(|e| e.installed)
            .map(|e| e.model)
            .collect();
        assert_eq!(installed, vec![AiModel::RealEsrganX2]);

        let entry = cat
            .models
            .iter()
            .find(|e| e.model == AiModel::RealEsrganX2)
            .unwrap();
        assert!(entry.path.as_ref().unwrap().ends_with(".onnx"));

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn default_catalog_has_all_models() {
        let cat = default_catalog();
        assert_eq!(cat.models.len(), 5);
        for entry in &cat.models {
            assert!(!entry.installed);
            assert!(entry.size_mb > 0);
        }
    }

    #[test]
    fn model_ids_are_filesystem_safe() {
        let all = [
            AiModel::RealEsrganX2,
            AiModel::RealEsrganX4,
            AiModel::Rife4,
            AiModel::DeepFilterNet,
            AiModel::BasicVsr,
        ];
        for m in all {
            let id = m.id();
            assert!(
                id.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
                "model id `{id}` must be filesystem-safe (no spaces, slashes, dots)"
            );
        }
    }
}
