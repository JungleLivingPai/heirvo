//! Recovery health score — a 0..=100 estimate of how well a recovery went.
//!
//! Combines:
//! - Coverage   (% sectors successfully read)
//! - Critical structures (PVD, VIDEO_TS.IFO, VTS_*_0.IFO must be intact)
//! - Damage distribution (one big scratch is worse than scattered single-sector errors)

use crate::dvd::iso9660::IsoEntry;
use crate::recovery::map::{SectorMap, SectorState};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthReport {
    pub score: u8,
    pub coverage_pct: f32,
    pub critical_intact: bool,
    pub failed_sectors: u64,
    pub largest_failed_run: u64,
    pub summary: String,
}

pub fn compute(map: &SectorMap, video_ts: Option<&[IsoEntry]>) -> HealthReport {
    let total = map.total();
    let good = map.count(SectorState::Good);
    let failed = map.count(SectorState::Failed) + map.count(SectorState::Skipped);
    let coverage = if total > 0 { good as f32 / total as f32 } else { 0.0 };

    let largest_run = map
        .runs(SectorState::Failed)
        .map(|(s, e)| e - s)
        .max()
        .unwrap_or(0);

    // Penalize big contiguous failed runs more than scattered ones.
    let run_penalty = ((largest_run as f32).log10().max(0.0) * 5.0).min(30.0);

    // Check critical IFO/BUP files are fully intact.
    let mut critical_intact = true;
    if let Some(entries) = video_ts {
        for e in entries {
            let upper = e.name.to_ascii_uppercase();
            if upper.ends_with(".IFO") || upper.ends_with(".BUP") {
                for lba in e.start_lba..e.end_lba_exclusive() {
                    if !matches!(map.get(lba), SectorState::Good) {
                        critical_intact = false;
                        break;
                    }
                }
                if !critical_intact {
                    break;
                }
            }
        }
    }

    let mut score = (coverage * 100.0) - run_penalty;
    if !critical_intact {
        score -= 25.0;
    }
    let score = score.clamp(0.0, 100.0).round() as u8;

    let summary = if score >= 95 {
        "Excellent — disc fully recovered.".to_string()
    } else if score >= 80 {
        "Good — minor damage, video should play with brief glitches.".to_string()
    } else if score >= 50 {
        "Partial — significant damage, some titles may be unplayable.".to_string()
    } else if !critical_intact {
        "Critical structures damaged — DVD navigation may not work.".to_string()
    } else {
        "Severe damage — only fragments are recoverable.".to_string()
    };

    HealthReport {
        score,
        coverage_pct: coverage * 100.0,
        critical_intact,
        failed_sectors: failed,
        largest_failed_run: largest_run,
        summary,
    }
}
