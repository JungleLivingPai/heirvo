//! Manifest of corruptions applied to an ISO. Serialised to JSON.

use serde::{Deserialize, Serialize};
use std::path::Path;

pub const SECTOR_SIZE: u64 = 2048;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum CorruptionRecord {
    /// A run of one or more contiguous sectors that were zeroed.
    ZeroedSectors {
        start_lba: u64,
        length: u64,
        reason: String,
    },
    /// A named file whose extent was zeroed.
    ZeroedFile {
        path: String,
        start_lba: u64,
        length_sectors: u64,
        size_bytes: u64,
    },
    /// File truncated by N bytes from the end.
    TruncatedFile {
        path: String,
        bytes_removed: u64,
        new_size: u64,
    },
    /// PVD / volume descriptor invalidated.
    InvalidatedVolumeDescriptor { sector: u64 },
    /// Whole-file truncation of the ISO image.
    TruncatedImage { bytes_removed: u64, new_size: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub source_iso: String,
    pub output_iso: String,
    pub source_size_bytes: u64,
    pub output_size_bytes: u64,
    pub seed: Option<u64>,
    pub mode: String,
    pub records: Vec<CorruptionRecord>,
}

impl Manifest {
    pub fn new(source: &Path, output: &Path, mode: &str) -> Self {
        Self {
            source_iso: source.display().to_string(),
            output_iso: output.display().to_string(),
            source_size_bytes: 0,
            output_size_bytes: 0,
            seed: None,
            mode: mode.to_string(),
            records: Vec::new(),
        }
    }

    pub fn push(&mut self, rec: CorruptionRecord) {
        self.records.push(rec);
    }

    pub fn write_json(&self, path: &Path) -> anyhow::Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn write_summary(&self, path: &Path) -> anyhow::Result<()> {
        use std::fmt::Write;
        let mut s = String::new();
        writeln!(s, "synth-disc corruption summary")?;
        writeln!(s, "==============================")?;
        writeln!(s, "source : {}", self.source_iso)?;
        writeln!(s, "output : {}", self.output_iso)?;
        writeln!(s, "mode   : {}", self.mode)?;
        if let Some(seed) = self.seed {
            writeln!(s, "seed   : {}", seed)?;
        }
        writeln!(
            s,
            "size   : {} -> {} bytes",
            self.source_size_bytes, self.output_size_bytes
        )?;
        writeln!(s, "records: {}", self.records.len())?;
        writeln!(s)?;
        for (i, r) in self.records.iter().enumerate() {
            writeln!(s, "  [{}] {}", i, format_record(r))?;
        }
        std::fs::write(path, s)?;
        Ok(())
    }

    /// Total number of sectors covered by zero-fill records.
    pub fn zeroed_sector_total(&self) -> u64 {
        self.records
            .iter()
            .map(|r| match r {
                CorruptionRecord::ZeroedSectors { length, .. } => *length,
                CorruptionRecord::ZeroedFile { length_sectors, .. } => *length_sectors,
                _ => 0,
            })
            .sum()
    }
}

fn format_record(r: &CorruptionRecord) -> String {
    match r {
        CorruptionRecord::ZeroedSectors { start_lba, length, reason } => {
            format!(
                "zeroed sectors LBA {}..{} ({} sectors) — {}",
                start_lba,
                start_lba + length,
                length,
                reason
            )
        }
        CorruptionRecord::ZeroedFile { path, start_lba, length_sectors, size_bytes } => {
            format!(
                "zeroed file {} at LBA {}..{} ({} bytes)",
                path,
                start_lba,
                start_lba + length_sectors,
                size_bytes
            )
        }
        CorruptionRecord::TruncatedFile { path, bytes_removed, new_size } => {
            format!(
                "truncated file {} by {} bytes (now {})",
                path, bytes_removed, new_size
            )
        }
        CorruptionRecord::InvalidatedVolumeDescriptor { sector } => {
            format!("invalidated volume descriptor at sector {}", sector)
        }
        CorruptionRecord::TruncatedImage { bytes_removed, new_size } => {
            format!(
                "truncated image by {} bytes (now {})",
                bytes_removed, new_size
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn manifest_roundtrip_json() {
        let mut m = Manifest::new(
            &PathBuf::from("clean.iso"),
            &PathBuf::from("corrupt.iso"),
            "random-bad-sectors",
        );
        m.seed = Some(42);
        m.source_size_bytes = 4096;
        m.output_size_bytes = 4096;
        m.push(CorruptionRecord::ZeroedSectors {
            start_lba: 100,
            length: 1,
            reason: "test".into(),
        });
        let json = serde_json::to_string(&m).unwrap();
        let back: Manifest = serde_json::from_str(&json).unwrap();
        assert_eq!(back.records.len(), 1);
        assert_eq!(back.seed, Some(42));
        assert_eq!(back.mode, "random-bad-sectors");
    }

    #[test]
    fn record_kinds_serialise_with_tag() {
        let r = CorruptionRecord::ZeroedFile {
            path: "/VIDEO_TS/VIDEO_TS.IFO".into(),
            start_lba: 312,
            length_sectors: 8,
            size_bytes: 16384,
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"kind\":\"zeroed_file\""));
        assert!(s.contains("VIDEO_TS.IFO"));
    }

    #[test]
    fn zeroed_sector_total_sums_lengths() {
        let mut m = Manifest::new(
            &PathBuf::from("a"),
            &PathBuf::from("b"),
            "multi",
        );
        m.push(CorruptionRecord::ZeroedSectors {
            start_lba: 0,
            length: 3,
            reason: "x".into(),
        });
        m.push(CorruptionRecord::ZeroedFile {
            path: "/X".into(),
            start_lba: 10,
            length_sectors: 5,
            size_bytes: 2048 * 5,
        });
        m.push(CorruptionRecord::TruncatedFile {
            path: "/Y".into(),
            bytes_removed: 100,
            new_size: 0,
        });
        assert_eq!(m.zeroed_sector_total(), 8);
    }
}
