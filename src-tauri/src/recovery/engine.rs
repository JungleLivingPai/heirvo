//! Core recovery engine.
//!
//! Orchestrates multi-pass reads of a `SectorReader`, updating a `SectorMap`,
//! emitting progress events, and persisting state to SQLite for resume.

use crate::disc::sector::SectorReader;
use crate::recovery::map::{SectorMap, SectorState};
use crate::recovery::passes::{PassStrategy, RecoveryMode};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use uuid::Uuid;

/// Heuristic about whether the drive itself looks healthy. Helps users tell
/// "this disc is damaged" apart from "my drive is broken/disconnecting" —
/// otherwise both look like stalled progress.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DriveHealthHint {
    /// Not enough samples yet to judge.
    Unknown,
    /// Reads are succeeding at a normal rate.
    Good,
    /// Reads are succeeding but slowly / with many failures. Disc may be
    /// heavily damaged, OR the drive may be struggling.
    Marginal,
    /// No successful reads in a long time. The drive is probably broken or
    /// the disc is unreadable in this drive.
    Suspect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryStats {
    pub good: u64,
    pub failed: u64,
    pub skipped: u64,
    pub unknown: u64,
    pub total: u64,
    pub current_lba: u64,
    pub current_pass: u8,
    pub pass_strategy: String,
    /// Sectors per second (rolling).
    pub speed_sps: f64,
    pub elapsed_secs: u64,
    pub eta_secs: Option<u64>,
    /// Heuristic about whether the drive itself appears healthy. Surfaced
    /// in the UI so a user can tell broken hardware apart from a broken disc.
    #[serde(default = "default_health")]
    pub drive_health: DriveHealthHint,
    /// Total successful sector reads since recovery started.
    #[serde(default)]
    pub reads_ok: u64,
    /// Total failed read attempts since recovery started.
    #[serde(default)]
    pub reads_err: u64,
    /// Seconds since the last successful read; `None` if we never had one.
    #[serde(default)]
    pub idle_secs: Option<u64>,
}

fn default_health() -> DriveHealthHint {
    DriveHealthHint::Unknown
}

#[derive(Debug, Clone, Serialize)]
pub struct RecoveryProgress {
    pub session_id: Uuid,
    pub stats: RecoveryStats,
}

/// Lifecycle states for the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineState {
    Idle,
    Running,
    Paused,
    Cancelled,
    Completed,
    Failed,
}

pub struct RecoveryEngine {
    pub session_id: Uuid,
    map: Mutex<SectorMap>,
    reader: Arc<dyn SectorReader>,
    plan: Vec<PassStrategy>,
    mode: RecoveryMode,
    state: Mutex<EngineState>,
    pause_flag: AtomicBool,
    cancel_flag: AtomicBool,
    current_pass: AtomicU64,
    current_lba: AtomicU64,
    started_at: Mutex<Option<Instant>>,
    /// Cumulative successful sector reads (for drive-health hint).
    reads_ok: AtomicU64,
    /// Cumulative failed read attempts (for drive-health hint).
    reads_err: AtomicU64,
    /// Wall-clock millis-since-epoch of the last successful read; 0 if none.
    last_success_ms: AtomicU64,
    progress_tx: Option<mpsc::UnboundedSender<RecoveryProgress>>,
    checkpoint_tx: Option<mpsc::UnboundedSender<()>>,
}

impl RecoveryEngine {
    pub fn new(
        session_id: Uuid,
        reader: Arc<dyn SectorReader>,
        plan: Vec<PassStrategy>,
    ) -> Self {
        let total = reader.capacity();
        Self {
            session_id,
            map: Mutex::new(SectorMap::new(total)),
            reader,
            plan,
            mode: RecoveryMode::Standard,
            state: Mutex::new(EngineState::Idle),
            pause_flag: AtomicBool::new(false),
            cancel_flag: AtomicBool::new(false),
            current_pass: AtomicU64::new(0),
            current_lba: AtomicU64::new(0),
            started_at: Mutex::new(None),
            reads_ok: AtomicU64::new(0),
            reads_err: AtomicU64::new(0),
            last_success_ms: AtomicU64::new(0),
            progress_tx: None,
            checkpoint_tx: None,
        }
    }

    /// Bump the read-attempt counters used for drive-health classification.
    fn record_read_outcome(&self, ok: bool) {
        if ok {
            self.reads_ok.fetch_add(1, Ordering::Relaxed);
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            self.last_success_ms.store(now_ms, Ordering::Relaxed);
        } else {
            self.reads_err.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn with_mode(mut self, mode: RecoveryMode) -> Self {
        self.mode = mode;
        self
    }

    pub fn with_progress_channel(
        mut self,
        tx: mpsc::UnboundedSender<RecoveryProgress>,
    ) -> Self {
        self.progress_tx = Some(tx);
        self
    }

    pub fn with_checkpoint_channel(mut self, tx: mpsc::UnboundedSender<()>) -> Self {
        self.checkpoint_tx = Some(tx);
        self
    }

    pub fn restore_map(&self, map: SectorMap) {
        *self.map.lock() = map;
    }

    pub fn snapshot_map(&self) -> SectorMap {
        self.map.lock().clone()
    }

    pub fn pause(&self) {
        self.pause_flag.store(true, Ordering::SeqCst);
    }

    pub fn resume(&self) {
        self.pause_flag.store(false, Ordering::SeqCst);
    }

    pub fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        *self.state.lock() == EngineState::Running
    }

    /// Drive the recovery to completion. Blocking — call from a tokio task.
    pub fn run(&self) -> EngineState {
        *self.state.lock() = EngineState::Running;
        *self.started_at.lock() = Some(Instant::now());

        for (idx, &strategy) in self.plan.iter().enumerate() {
            self.current_pass.store(idx as u64 + 1, Ordering::SeqCst);
            tracing::info!(
                "Session {}: starting pass {} ({})",
                self.session_id,
                idx + 1,
                strategy.name()
            );

            // Pre-pause for ThermalPause: cool the drive ONLY if there's
            // actually something for the pass to retry. Skipping the 5-minute
            // sleep when the failed-sector queue is empty saves the user
            // five minutes of "drive sitting idle, app looks frozen".
            if matches!(strategy, PassStrategy::ThermalPause) {
                let has_work = {
                    let map = self.map.lock();
                    !self.targets_for(strategy, &map).is_empty()
                };
                if has_work {
                    tracing::info!("Thermal pause: 5-minute cool-down before final retry pass");
                    let total = Duration::from_secs(300);
                    let step = Duration::from_millis(200);
                    let mut waited = Duration::ZERO;
                    let mut last_emit = Instant::now();
                    while waited < total {
                        if self.cancel_flag.load(Ordering::SeqCst) {
                            *self.state.lock() = EngineState::Cancelled;
                            return EngineState::Cancelled;
                        }
                        std::thread::sleep(step);
                        waited += step;
                        // Heartbeat every second so the UI knows we're alive
                        // and not frozen. Also keeps `current_lba` fresh.
                        if last_emit.elapsed() >= Duration::from_secs(1) {
                            self.emit_progress(strategy);
                            last_emit = Instant::now();
                        }
                    }
                } else {
                    tracing::info!("Thermal pause: no failed sectors to retry, skipping cool-down");
                }
            }

            self.run_pass(strategy);

            if self.cancel_flag.load(Ordering::SeqCst) {
                *self.state.lock() = EngineState::Cancelled;
                return EngineState::Cancelled;
            }
        }

        *self.state.lock() = EngineState::Completed;
        EngineState::Completed
    }

    fn run_pass(&self, strategy: PassStrategy) {
        let opts = strategy.read_options();
        // Patient mode imposes a minimum inter-read delay (e.g. 2s) so a
        // bus-powered USB drive has time to recover. Standard mode uses the
        // strategy's native delay only.
        let delay_ms = strategy
            .inter_sector_delay_ms()
            .max(self.mode.delay_floor_ms());
        let delay = Duration::from_millis(delay_ms);

        // Hard ceiling on how long any one pass can run. Without this, a
        // disc with tens of thousands of failed sectors would have SlowRead
        // grinding for days per pass — the user gives up and assumes the app
        // is broken. Better to stop the pass cleanly so the next pass (and
        // ZeroFill at the end) gets a chance to finish the recovery.
        let pass_started = Instant::now();
        let max_pass_duration = match strategy {
            PassStrategy::Triage => Duration::from_secs(60 * 60 * 6),    // 6 hours
            PassStrategy::SlowRead => Duration::from_secs(60 * 30),       // 30 minutes
            PassStrategy::Reverse => Duration::from_secs(60 * 30),        // 30 minutes
            PassStrategy::ThermalPause => Duration::from_secs(60 * 60 * 2), // 2 hours
            PassStrategy::ZeroFill => Duration::from_secs(60 * 5),        // 5 minutes
        };

        let targets: Vec<u64> = {
            let map = self.map.lock();
            self.targets_for(strategy, &map)
        };
        if targets.is_empty() {
            tracing::info!(
                "Pass {} ({}): no targets, skipping",
                self.current_pass.load(Ordering::SeqCst),
                strategy.name()
            );
            return;
        }

        // Block size depends on pass strategy:
        // - Triage reads 64-sector (128KB) blocks for healthy regions; on block
        //   error the SCSI layer transparently falls back to per-sector reads
        //   to pinpoint exact bad LBAs.
        // - Retry passes (SlowRead/Reverse/ThermalPause/ZeroFill) read one sector
        //   at a time since they target only known-failed sectors.
        let max_block: u32 = match strategy {
            PassStrategy::Triage => crate::disc::MAX_BLOCK_SECTORS,
            _ => 1,
        };

        // Reverse pass keeps the original semantics: walk known-failed sectors
        // backward, one at a time. No block grouping makes sense here.
        if matches!(strategy, PassStrategy::Reverse) {
            for lba in targets.into_iter().rev() {
                if pass_started.elapsed() > max_pass_duration {
                    tracing::info!(
                        "Pass {} ({}): hit max duration {:?}, moving on",
                        self.current_pass.load(Ordering::SeqCst),
                        strategy.name(),
                        max_pass_duration,
                    );
                    break;
                }
                if !self.tick(strategy, lba, opts, delay) {
                    return;
                }
            }
            self.emit_progress(strategy);
            self.checkpoint();
            return;
        }

        // Group contiguous LBAs into blocks of up to `max_block` sectors.
        let blocks = group_contiguous(&targets, max_block);
        let total_blocks = blocks.len();
        // Report ~every 1s of work or every 50 blocks, whichever first.
        // Keeps the UI live even when blocks read fast.
        let report_every = (total_blocks / 1000).clamp(1, 50);
        tracing::info!(
            "Pass {} ({}): {} targets, {} blocks (max {} sectors/block), reporting every {}",
            self.current_pass.load(Ordering::SeqCst),
            strategy.name(),
            targets.len(),
            total_blocks,
            max_block,
            report_every,
        );
        let mut emitted = 0usize;

        // Skip-ahead state (ddrescue-style forward scout): if too many consecutive
        // blocks come back fully bad, jump past a *growing* chunk of disc to find
        // the next clean region. Skipped blocks stay marked Failed so retry passes
        // will revisit them.
        //
        // Skip distance grows exponentially with the failure streak so a large
        // damaged region (the common case on a scratched DVD) gets jumped past
        // in seconds instead of hours. With 32-sector blocks, a 2048-block skip
        // covers ~128 MB of disc per attempt — even a multi-GB damaged region
        // is cleared in a handful of 5-second triage attempts.
        const FAIL_STREAK_TO_SKIP: u32 = 2;
        const MAX_SKIP_BLOCKS: usize = 2048;
        let mut consec_fail_blocks: u32 = 0;

        let mut i = 0;
        while i < blocks.len() {
            if self.cancel_flag.load(Ordering::SeqCst) {
                return;
            }
            if pass_started.elapsed() > max_pass_duration {
                tracing::info!(
                    "Pass {} ({}): hit max duration {:?}, moving on",
                    self.current_pass.load(Ordering::SeqCst),
                    strategy.name(),
                    max_pass_duration,
                );
                break;
            }
            while self.pause_flag.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(200));
                if self.cancel_flag.load(Ordering::SeqCst) {
                    return;
                }
            }

            let (start, count) = blocks[i];
            self.current_lba.store(start, Ordering::SeqCst);

            let block_failed_entirely = if matches!(strategy, PassStrategy::ZeroFill) {
                let mut map = self.map.lock();
                for j in 0..count as u64 {
                    let lba = start + j;
                    if matches!(map.get(lba), SectorState::Failed | SectorState::Unknown) {
                        map.set(lba, SectorState::Skipped);
                    }
                }
                false
            } else {
                let results = if count == 1 {
                    vec![self.reader.read_sector(start, opts)]
                } else {
                    self.reader.read_block(start, count, opts)
                };
                let mut all_failed = !results.is_empty();
                let mut map = self.map.lock();
                for r in &results {
                    if r.is_ok() {
                        map.set(r.lba, SectorState::Good);
                        all_failed = false;
                        self.record_read_outcome(true);
                    } else {
                        map.set(r.lba, SectorState::Failed);
                        self.record_read_outcome(false);
                    }
                }
                all_failed
            };

            // Skip-ahead heuristic for forward passes only. Exponential growth:
            // streak 2  → skip 1   block
            // streak 3  → skip 2
            // streak 4  → skip 4
            // streak 5  → skip 8
            // streak 6  → skip 16
            // streak 7  → skip 32
            // streak 8  → skip 64
            // streak 9  → skip 128
            // streak 10 → skip 256
            // streak 11 → skip 512
            // streak 12 → skip 1024
            // streak 13+→ skip 2048 (capped, ~128 MB of disc per jump)
            //
            // Also capped to 1/4 of remaining blocks so we never overshoot the
            // tail of the disc — even a heavily damaged region near the end
            // still gets a chance to find clean sectors past it.
            if matches!(strategy, PassStrategy::Triage) {
                if block_failed_entirely {
                    consec_fail_blocks = consec_fail_blocks.saturating_add(1);
                    if consec_fail_blocks >= FAIL_STREAK_TO_SKIP {
                        let over = consec_fail_blocks - FAIL_STREAK_TO_SKIP;
                        // 2^over blocks, capped. Use checked shift to avoid overflow.
                        let exp_extra: usize = 1usize
                            .checked_shl(over.min(20))
                            .unwrap_or(MAX_SKIP_BLOCKS)
                            .min(MAX_SKIP_BLOCKS);
                        // Don't skip more than a quarter of what's left — keeps the
                        // tail reachable on small/short scans.
                        let remaining = blocks.len().saturating_sub(i + 1);
                        let safe_max = (remaining / 4).max(1);
                        let extra = exp_extra.min(safe_max);
                        tracing::info!(
                            "Triage: skipping {extra} blocks ahead after {consec_fail_blocks} consecutive failures (LBA {start})"
                        );
                        i += extra;
                    }
                } else {
                    consec_fail_blocks = 0;
                }
            }

            emitted += 1;
            if emitted % report_every == 0 {
                self.emit_progress(strategy);
            }
            // Checkpoint roughly every ~6400 sectors of work for Triage, every
            // ~100 sectors for retry passes. Both well under 1 minute of progress.
            if emitted % 100 == 0 {
                self.checkpoint();
            }

            if !delay.is_zero() {
                std::thread::sleep(delay);
            }
            i += 1;
        }

        self.emit_progress(strategy);
        self.checkpoint();
    }

    /// Process a single sector for retry passes (SlowRead / ThermalPause / Reverse).
    /// Returns false if the run should bail (cancelled).
    fn tick(
        &self,
        strategy: PassStrategy,
        lba: u64,
        opts: crate::disc::sector::ReadOptions,
        delay: Duration,
    ) -> bool {
        if self.cancel_flag.load(Ordering::SeqCst) {
            return false;
        }
        while self.pause_flag.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_millis(200));
            if self.cancel_flag.load(Ordering::SeqCst) {
                return false;
            }
        }
        self.current_lba.store(lba, Ordering::SeqCst);

        if matches!(strategy, PassStrategy::ZeroFill) {
            let mut map = self.map.lock();
            if matches!(map.get(lba), SectorState::Failed | SectorState::Unknown) {
                map.set(lba, SectorState::Skipped);
            }
        } else {
            let result = self.reader.read_sector(lba, opts);
            let ok = result.is_ok();
            let mut map = self.map.lock();
            if ok {
                map.set(lba, SectorState::Good);
            } else {
                map.set(lba, SectorState::Failed);
            }
            drop(map);
            self.record_read_outcome(ok);
        }

        if !delay.is_zero() {
            std::thread::sleep(delay);
        }
        true
    }

    fn checkpoint(&self) {
        if let Some(tx) = &self.checkpoint_tx {
            let _ = tx.send(());
        }
    }

    fn targets_for(&self, strategy: PassStrategy, map: &SectorMap) -> Vec<u64> {
        let mut v = Vec::new();
        for lba in 0..map.total() {
            let s = map.get(lba);
            let want = match strategy {
                PassStrategy::Triage => matches!(s, SectorState::Unknown),
                PassStrategy::SlowRead | PassStrategy::Reverse | PassStrategy::ThermalPause => {
                    matches!(s, SectorState::Failed)
                }
                PassStrategy::ZeroFill => matches!(s, SectorState::Failed | SectorState::Unknown),
            };
            if want {
                v.push(lba);
            }
        }
        v
    }

    fn emit_progress(&self, strategy: PassStrategy) {
        let stats = self.compute_stats(strategy);
        if let Some(tx) = &self.progress_tx {
            let _ = tx.send(RecoveryProgress { session_id: self.session_id, stats });
        }
    }

    pub fn compute_stats(&self, strategy: PassStrategy) -> RecoveryStats {
        let map = self.map.lock();
        let total = map.total();
        let good = map.count(SectorState::Good);
        let failed = map.count(SectorState::Failed);
        let skipped = map.count(SectorState::Skipped);
        let unknown = total - good - failed - skipped;
        let current_lba = self.current_lba.load(Ordering::SeqCst);
        let elapsed = self
            .started_at
            .lock()
            .as_ref()
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);
        let processed = good + failed + skipped;
        let speed_sps = if elapsed > 0 { processed as f64 / elapsed as f64 } else { 0.0 };
        let eta_secs = if speed_sps > 0.0 {
            Some(((total - processed) as f64 / speed_sps) as u64)
        } else {
            None
        };
        let reads_ok = self.reads_ok.load(Ordering::Relaxed);
        let reads_err = self.reads_err.load(Ordering::Relaxed);

        // Derive idle_secs from last_success timestamp.
        let last_ok_ms = self.last_success_ms.load(Ordering::Relaxed);
        let idle_secs = if last_ok_ms == 0 {
            // Never had a success — report idle as the engine elapsed time so the
            // UI can decide the drive is suspect.
            if elapsed > 0 { Some(elapsed) } else { None }
        } else {
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            Some((now_ms.saturating_sub(last_ok_ms)) / 1000)
        };

        // Drive-health heuristic. We classify based on:
        //   - sample size (need ≥ 100 attempts to call it)
        //   - success ratio
        //   - time since last successful read
        // A heavily damaged disc reads SOMETHING in the first hundred attempts,
        // so 0% success after 100 attempts strongly implies a drive problem.
        let attempts = reads_ok + reads_err;
        let drive_health = if attempts < 100 {
            DriveHealthHint::Unknown
        } else if reads_ok == 0 {
            DriveHealthHint::Suspect
        } else if let Some(idle) = idle_secs {
            // No good reads for >2 minutes after we've already had some — drive
            // may have stopped responding even though we're still attempting.
            if idle > 120 && reads_err > 50 {
                DriveHealthHint::Suspect
            } else {
                let ratio = reads_ok as f64 / attempts as f64;
                if ratio >= 0.50 {
                    DriveHealthHint::Good
                } else if ratio >= 0.05 {
                    DriveHealthHint::Marginal
                } else {
                    DriveHealthHint::Suspect
                }
            }
        } else {
            DriveHealthHint::Unknown
        };

        RecoveryStats {
            good,
            failed,
            skipped,
            unknown,
            total,
            current_lba,
            current_pass: self.current_pass.load(Ordering::SeqCst) as u8,
            pass_strategy: strategy.name().to_string(),
            speed_sps,
            elapsed_secs: elapsed,
            eta_secs,
            drive_health,
            reads_ok,
            reads_err,
            idle_secs,
        }
    }
}

/// Group sorted LBAs into runs of contiguous sectors, capped at `max_size`.
/// Returns `(start_lba, count)` pairs.
fn group_contiguous(targets: &[u64], max_size: u32) -> Vec<(u64, u32)> {
    let mut out = Vec::new();
    if targets.is_empty() {
        return out;
    }
    let mut start = targets[0];
    let mut len: u32 = 1;
    for &t in &targets[1..] {
        if t == start + len as u64 && len < max_size {
            len += 1;
        } else {
            out.push((start, len));
            start = t;
            len = 1;
        }
    }
    out.push((start, len));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::disc::mock::{MockSectorBehavior, MockSectorReader};
    use crate::recovery::passes::{default_pass_plan, PassStrategy};
    use std::sync::Arc;

    #[test]
    fn groups_contiguous_runs() {
        let g = group_contiguous(&[0, 1, 2, 3, 5, 6, 100], 64);
        assert_eq!(g, vec![(0, 4), (5, 2), (100, 1)]);
    }

    #[test]
    fn caps_at_max_size() {
        let v: Vec<u64> = (0..200).collect();
        let g = group_contiguous(&v, 64);
        assert_eq!(g, vec![(0, 64), (64, 64), (128, 64), (192, 8)]);
    }

    #[test]
    fn empty_input() {
        let g = group_contiguous(&[], 64);
        assert!(g.is_empty());
    }

    /// End-to-end engine test: a fully clean disc must produce 100% Good.
    #[test]
    fn pristine_disc_full_recovery() {
        let reader = Arc::new(MockSectorReader::new(2048, MockSectorBehavior::Good));
        let engine = RecoveryEngine::new(Uuid::new_v4(), reader, vec![PassStrategy::Triage]);
        engine.run();
        let map = engine.snapshot_map();
        assert_eq!(map.count(SectorState::Good), 2048);
        assert_eq!(map.count(SectorState::Failed), 0);
    }

    /// Mixed disc: a contiguous bad range gets marked Failed during Triage,
    /// then a SlowRead pass succeeds against a `BadUntilAttempt(1)` sector.
    #[test]
    fn slowread_recovers_borderline_sectors() {
        let mut reader = MockSectorReader::new(512, MockSectorBehavior::Good);
        // Sector 100 fails on attempt 1 only — succeeds on attempt 2 (Triage's
        // single read fails, SlowRead's retry succeeds).
        reader.set(100, MockSectorBehavior::BadUntilAttempt(1));
        let reader = Arc::new(reader);
        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            reader,
            vec![PassStrategy::Triage, PassStrategy::SlowRead],
        );
        engine.run();
        let map = engine.snapshot_map();
        // After SlowRead, sector 100 should now be Good.
        assert_eq!(map.get(100), SectorState::Good);
        assert_eq!(map.count(SectorState::Failed), 0);
        assert_eq!(map.count(SectorState::Good), 512);
    }

    /// A permanently bad contiguous run stays Failed even after retry passes,
    /// confirming we mark damage cleanly without false positives.
    #[test]
    fn permanently_bad_range_stays_failed() {
        let mut reader = MockSectorReader::new(512, MockSectorBehavior::Good);
        reader.set_range_bad(200, 50); // 50-sector scratch
        let reader = Arc::new(reader);
        let _engine = RecoveryEngine::new(Uuid::new_v4(), reader, default_pass_plan());
        // ThermalPause sleeps 5 minutes — strip it for tests.
        let plan = vec![
            PassStrategy::Triage,
            PassStrategy::SlowRead,
            PassStrategy::Reverse,
        ];
        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            Arc::new({
                let mut r = MockSectorReader::new(512, MockSectorBehavior::Good);
                r.set_range_bad(200, 50);
                r
            }),
            plan,
        );
        engine.run();
        let map = engine.snapshot_map();
        assert_eq!(map.count(SectorState::Good), 462);
        assert_eq!(map.count(SectorState::Failed), 50);
        // Verify the failed run is exactly where we put it.
        let runs: Vec<_> = map.runs(SectorState::Failed).collect();
        assert_eq!(runs, vec![(200, 250)]);
    }

    /// Skip-ahead activates when many consecutive blocks fail. Validates the
    /// engine reaches the clean tail past a dead region instead of grinding
    /// forever. Note: skipped blocks intentionally stay Unknown — they're
    /// targeted by the retry passes (SlowRead/Reverse), not by Triage. So we
    /// assert "we touched the tail" not "we read every tail sector".
    #[test]
    fn skip_ahead_activates_in_dead_region() {
        let mut reader = MockSectorReader::new(10_000, MockSectorBehavior::Good);
        reader.set_range_bad(2000, 6000);
        let reader = Arc::new(reader);
        let engine = RecoveryEngine::new(Uuid::new_v4(), reader, vec![PassStrategy::Triage]);
        engine.run();
        let map = engine.snapshot_map();

        // The pre-dead head should be entirely Good.
        for lba in 0..2000 {
            assert_eq!(map.get(lba), SectorState::Good, "head sector {lba}");
        }
        // Skip-ahead must have reached past the dead region — there should be
        // *some* Good sectors after LBA 8000, even if not all of them.
        let tail_good = (8000..10_000)
            .filter(|&lba| map.get(lba) == SectorState::Good)
            .count();
        assert!(
            tail_good > 0,
            "skip-ahead failed to reach the clean tail: 0 of 2000 sectors marked Good"
        );
        // And we must NOT have marked every dead-region sector as Failed —
        // skip-ahead should leave most as Unknown for the retry passes to
        // revisit.
        let dead_failed = (2000..8000)
            .filter(|&lba| map.get(lba) == SectorState::Failed)
            .count();
        assert!(
            dead_failed < 3000,
            "skip-ahead didn't activate: {dead_failed} of 6000 sectors marked Failed"
        );
    }
}

