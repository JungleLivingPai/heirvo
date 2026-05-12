//! synth-disc — synthetic damaged DVD-ISO generator.
//!
//! See README.md for usage examples.

mod corrupt;
mod iso9660;
mod manifest;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::manifest::Manifest;

#[derive(Parser, Debug)]
#[command(
    name = "synth-disc",
    version,
    about = "Generate corrupted DVD-ISO images for recovery-engine testing"
)]
struct Cli {
    /// Path to the clean source ISO.
    #[arg(short, long, global = true)]
    input: Option<PathBuf>,
    /// Output directory (corrupted.iso + manifest.json + summary.txt).
    #[arg(short, long, global = true)]
    output: Option<PathBuf>,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Pick N random sectors and zero them.
    RandomBadSectors {
        #[arg(long)]
        count: u64,
        #[arg(long, default_value_t = 0xC0FFEE)]
        seed: u64,
    },
    /// Zero a contiguous run of sectors.
    ContiguousRange {
        #[arg(long)]
        start: u64,
        #[arg(long)]
        length: u64,
    },
    /// Zero all .IFO files (forces BUP fallback).
    CorruptIfo,
    /// Zero all .BUP files.
    MissingBup,
    /// Truncate the largest VOB by N bytes.
    TruncateVobs {
        #[arg(long)]
        bytes: u64,
    },
    /// Invalidate the volume descriptor (simulates unfinalised disc).
    Unfinalized,
    /// Apply multiple modes from a TOML config.
    Multi {
        #[arg(long)]
        config: PathBuf,
    },
}

#[derive(Debug, Deserialize, Default)]
struct MultiConfig {
    #[serde(default)]
    random_bad_sectors: Option<RandomCfg>,
    #[serde(default)]
    contiguous_range: Option<RangeCfg>,
    #[serde(default)]
    corrupt_ifo: Option<bool>,
    #[serde(default)]
    missing_bup: Option<bool>,
    #[serde(default)]
    truncate_vobs: Option<TruncateCfg>,
    #[serde(default)]
    unfinalized: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RandomCfg {
    count: u64,
    seed: u64,
}

#[derive(Debug, Deserialize)]
struct RangeCfg {
    start: u64,
    length: u64,
}

#[derive(Debug, Deserialize)]
struct TruncateCfg {
    bytes: u64,
}

fn require<T>(opt: Option<T>, name: &str) -> Result<T> {
    opt.ok_or_else(|| anyhow::anyhow!("--{} is required", name))
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let input = require(cli.input, "input")?;
    let output_dir = require(cli.output, "output")?;
    fs::create_dir_all(&output_dir)
        .with_context(|| format!("creating output directory {}", output_dir.display()))?;
    let output_iso = output_dir.join("corrupted.iso");
    let manifest_path = output_dir.join("manifest.json");
    let summary_path = output_dir.join("summary.txt");

    let mut image = fs::read(&input)
        .with_context(|| format!("reading input ISO {}", input.display()))?;
    let source_size = image.len() as u64;

    let mode_label = match &cli.cmd {
        Cmd::RandomBadSectors { .. } => "random-bad-sectors",
        Cmd::ContiguousRange { .. } => "contiguous-range",
        Cmd::CorruptIfo => "corrupt-ifo",
        Cmd::MissingBup => "missing-bup",
        Cmd::TruncateVobs { .. } => "truncate-vobs",
        Cmd::Unfinalized => "unfinalized",
        Cmd::Multi { .. } => "multi",
    };
    let mut manifest = Manifest::new(&input, &output_iso, mode_label);
    manifest.source_size_bytes = source_size;

    let final_len = match cli.cmd {
        Cmd::RandomBadSectors { count, seed } => {
            corrupt::random_bad_sectors(&mut image, &mut manifest, count, seed)?;
            image.len() as u64
        }
        Cmd::ContiguousRange { start, length } => {
            corrupt::contiguous_range(&mut image, &mut manifest, start, length)?;
            image.len() as u64
        }
        Cmd::CorruptIfo => {
            corrupt::corrupt_ifo(&mut image, &mut manifest)?;
            image.len() as u64
        }
        Cmd::MissingBup => {
            corrupt::missing_bup(&mut image, &mut manifest)?;
            image.len() as u64
        }
        Cmd::TruncateVobs { bytes } => {
            let new_len = corrupt::truncate_vobs_bytes(&image, &mut manifest, bytes)?;
            new_len
        }
        Cmd::Unfinalized => {
            corrupt::unfinalized(&mut image, &mut manifest)?;
            image.len() as u64
        }
        Cmd::Multi { config } => apply_multi(&mut image, &mut manifest, &config)?,
    };

    let final_len = final_len as usize;
    if final_len < image.len() {
        image.truncate(final_len);
    }
    manifest.output_size_bytes = image.len() as u64;

    fs::write(&output_iso, &image)
        .with_context(|| format!("writing output ISO {}", output_iso.display()))?;
    manifest.write_json(&manifest_path)?;
    manifest.write_summary(&summary_path)?;

    println!(
        "wrote {} ({} bytes), {} corruption record(s), zeroed {} sector(s)",
        output_iso.display(),
        manifest.output_size_bytes,
        manifest.records.len(),
        manifest.zeroed_sector_total()
    );
    println!("manifest: {}", manifest_path.display());
    println!("summary : {}", summary_path.display());
    Ok(())
}

fn apply_multi(image: &mut Vec<u8>, manifest: &mut Manifest, config: &Path) -> Result<u64> {
    let text = fs::read_to_string(config)
        .with_context(|| format!("reading multi config {}", config.display()))?;
    let cfg: MultiConfig =
        toml::from_str(&text).with_context(|| "parsing multi config TOML")?;

    if let Some(r) = cfg.random_bad_sectors {
        corrupt::random_bad_sectors(image, manifest, r.count, r.seed)?;
    }
    if let Some(r) = cfg.contiguous_range {
        corrupt::contiguous_range(image, manifest, r.start, r.length)?;
    }
    if cfg.corrupt_ifo.unwrap_or(false) {
        corrupt::corrupt_ifo(image, manifest)?;
    }
    if cfg.missing_bup.unwrap_or(false) {
        corrupt::missing_bup(image, manifest)?;
    }
    if cfg.unfinalized.unwrap_or(false) {
        corrupt::unfinalized(image, manifest)?;
    }
    let mut len = image.len() as u64;
    if let Some(t) = cfg.truncate_vobs {
        len = corrupt::truncate_vobs_bytes(image, manifest, t.bytes)?;
    }
    Ok(len)
}

#[cfg(test)]
mod tests {
    use super::corrupt::pick_random_lbas;

    #[test]
    fn random_lbas_are_distinct_and_sorted() {
        let lbas = pick_random_lbas(10_000, 50, 42);
        assert_eq!(lbas.len(), 50);
        for w in lbas.windows(2) {
            assert!(w[0] < w[1], "expected sorted+distinct");
        }
    }

    #[test]
    fn random_lbas_deterministic_with_seed() {
        let a = pick_random_lbas(10_000, 25, 123);
        let b = pick_random_lbas(10_000, 25, 123);
        let c = pick_random_lbas(10_000, 25, 124);
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn random_lbas_skip_system_area() {
        let lbas = pick_random_lbas(1000, 500, 7);
        for l in lbas {
            assert!(l >= 16, "LBA {} should be >= 16 (system area)", l);
            assert!(l < 1000);
        }
    }

    #[test]
    fn random_lbas_capped_at_total() {
        // Asking for more than available returns at most total-pool_start.
        let lbas = pick_random_lbas(20, 1000, 1);
        assert!(lbas.len() <= 4);
        for l in &lbas {
            assert!(*l >= 16 && *l < 20);
        }
    }
}
