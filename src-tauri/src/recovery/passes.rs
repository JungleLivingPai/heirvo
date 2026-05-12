//! Multi-pass recovery strategies.
//!
//! Each pass walks the sector map and acts on sectors in specific states:
//! - Triage: read every Unknown sector once, fast.
//! - SlowRead: revisit Failed sectors at reduced speed with more retries.
//! - Reverse: read Failed sectors in reverse order (some drives handle this better).
//! - ThermalPause: long pause + retry the worst remaining sectors.
//! - ZeroFill: mark remaining Failed sectors as Skipped, fill with zeros at output time.

use crate::disc::sector::ReadOptions;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PassStrategy {
    Triage,
    SlowRead,
    Reverse,
    ThermalPause,
    ZeroFill,
}

impl PassStrategy {
    pub fn name(&self) -> &'static str {
        match self {
            PassStrategy::Triage => "Fast Triage",
            PassStrategy::SlowRead => "Slow Read",
            PassStrategy::Reverse => "Reverse Read",
            PassStrategy::ThermalPause => "Thermal Pause",
            PassStrategy::ZeroFill => "Zero Fill",
        }
    }

    pub fn read_options(&self) -> ReadOptions {
        match self {
            // Triage races through healthy media. Tight timeout: if a 128KB block
            // can't be read in 5s, skip the region and let SlowRead deal with it.
            PassStrategy::Triage => ReadOptions { retries: 0, slow_mode: false, timeout_ms: 5_000 },
            // SlowRead/Reverse cycle through the failed-sector queue at a brisk
            // pace — short retry budget so the user sees the queue *moving*. The
            // exhaustive retry happens in ThermalPause after the disc has cooled.
            // (Old defaults of 4 retries × 60s = 4 minutes per failed sector
            // meant a 50k-sector failed queue took ~140 hours to grind through.)
            PassStrategy::SlowRead => ReadOptions { retries: 1, slow_mode: true, timeout_ms: 12_000 },
            PassStrategy::Reverse => ReadOptions { retries: 1, slow_mode: true, timeout_ms: 12_000 },
            // ThermalPause is the patient final pass — bigger retry budget here.
            PassStrategy::ThermalPause => {
                ReadOptions { retries: 4, slow_mode: true, timeout_ms: 60_000 }
            }
            PassStrategy::ZeroFill => ReadOptions::default(),
        }
    }

    /// Pause between sector reads (helps drive cool, lets head settle).
    pub fn inter_sector_delay_ms(&self) -> u64 {
        match self {
            PassStrategy::Triage => 0,
            PassStrategy::SlowRead => 100,
            PassStrategy::Reverse => 100,
            PassStrategy::ThermalPause => 500,
            PassStrategy::ZeroFill => 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryPass {
    pub number: u8,
    pub strategy: PassStrategy,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub sectors_recovered: u64,
    pub sectors_failed: u64,
}

/// Default sequence of passes for a fresh recovery.
pub fn default_pass_plan() -> Vec<PassStrategy> {
    vec![
        PassStrategy::Triage,
        PassStrategy::SlowRead,
        PassStrategy::Reverse,
        PassStrategy::ThermalPause,
    ]
}

/// User-facing recovery mode. Controls pass plan and per-sector pacing.
///
/// Standard: balanced — block triage first, slow retry, reverse, thermal pause.
///   Best for healthy drives + mostly-readable discs.
///
/// Patient: kind to weak drives. Skips block triage entirely (which can
///   stall on a brownout-prone bus-powered USB drive); reads every sector
///   one at a time with a long inter-read pause so the drive can recover
///   power and heat. Designed to run for hours overnight without disconnects.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RecoveryMode {
    #[default]
    Standard,
    Patient,
}

impl RecoveryMode {
    /// Minimum pause between sector reads in this mode. Strategy-level delay
    /// is used if larger than this floor.
    pub fn delay_floor_ms(&self) -> u64 {
        match self {
            RecoveryMode::Standard => 0,
            // 2 seconds between reads — gives a bus-powered USB drive time
            // to recover power before the next IOCTL. Empirically this is
            // the threshold below which cheap drives keep browning out on
            // home-burned DVDs.
            RecoveryMode::Patient => 2_000,
        }
    }
}

/// Pass plan keyed to recovery mode.
pub fn pass_plan(mode: RecoveryMode) -> Vec<PassStrategy> {
    match mode {
        RecoveryMode::Standard => default_pass_plan(),
        RecoveryMode::Patient => vec![
            // No block triage — patient mode reads sector-by-sector from
            // start so a brownout doesn't waste a 64-sector block. We give
            // the disc two slow passes and a thermal break in between.
            PassStrategy::SlowRead,
            PassStrategy::Reverse,
            PassStrategy::ThermalPause,
            PassStrategy::SlowRead,
        ],
    }
}
