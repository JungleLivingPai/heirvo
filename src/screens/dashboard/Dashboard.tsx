import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { gsap } from "gsap";
import { ipc, events } from "@/lib/ipc";
import type { RecoveryStats, RecoveryMode } from "@/lib/types";
import { SectorMapCanvas } from "./SectorMapCanvas";
import { OutputPanel } from "./OutputPanel";
import {
  DiscVariantPicker,
  DiscVariantRenderer,
  type VariantId,
} from "./disc-variants";
import { Pause, X, Activity, Play, Loader2, Disc3, RefreshCw, ChevronRight } from "lucide-react";
import type { DriveInfo } from "@/lib/types";
import {
  bytesToHuman,
  durationHuman,
  progressSentence,
  sectorsToBytes,
  sectorsToMinutes,
} from "@/lib/human";
import {
  countUp,
  headingReveal,
  pulseIn,
  sparkleBurst,
  staggerReveal,
  startShimmer,
} from "@/utils/gsap-fx";
import { friendlyError } from "@/lib/friendly-errors";
import { audio } from "@/lib/audio";

export function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<RecoveryStats | null>(null);
  const [bucketRow, setBucketRow] = useState<number[]>([]);
  const [lastProgressAt, setLastProgressAt] = useState<number>(Date.now());
  const [now, setNow] = useState(Date.now());
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [driveSwitchMsg, setDriveSwitchMsg] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState<RecoveryMode>(() => {
    try {
      const saved = id ? localStorage.getItem(`mode:${id}`) : null;
      return saved === "patient" ? "patient" : "standard";
    } catch { return "standard"; }
  });
  // Disc visualization style — user picks one and it persists across sessions.
  // Cinematic is the default: real telemetry on the rings, drifting particles,
  // Ken Burns motion, watch-face tick marks. Premium and ambient — feels like
  // a Vision Pro / WWDC keynote backdrop.
  const [discVariant, setDiscVariant] = useState<VariantId>(() => {
    try {
      const saved = localStorage.getItem("disc-variant") as VariantId | null;
      return saved ?? "activity-cinematic";
    } catch { return "activity-cinematic"; }
  });
  const onDiscVariantChange = (id: VariantId) => {
    setDiscVariant(id);
    try { localStorage.setItem("disc-variant", id); } catch { /* ignore */ }
  };

  const scopeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!id) return;
    const onProgress = events.onProgress((p) => {
      if (p.session_id === id) {
        setStats(p.stats);
        setLastProgressAt(Date.now());
      }
    });
    const onComplete = events.onComplete((sid) => {
      if (sid !== id) return;
      setRecoveryDone(true);
      // Audio cue (no-op if user has audio disabled — default).
      audio.play("recovery_done");
      // Toast notification so users know recovery finished even when the
      // window is in the background (disc reads can take hours).
      const notify = () =>
        new Notification("Heirvo — Recovery complete", {
          body: "Your disc has been scanned. Open Heirvo to save your files.",
          icon: "/favicon.svg",
        });
      if (Notification.permission === "granted") {
        notify();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => { if (p === "granted") notify(); });
      }
    });
    return () => {
      onProgress.then((fn) => fn());
      onComplete.then((fn) => fn());
    };
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Audio: emit a milestone tick whenever recovered % crosses each 10%
  // boundary. Refs so we don't fire on every progress event.
  const lastMilestoneTierRef = useRef<number>(-1);
  const lastRingTiersRef = useRef<{ recovered: boolean; damaged: boolean; scanned: boolean }>({
    recovered: false,
    damaged: false,
    scanned: false,
  });
  const lastDriveHealthRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!stats || stats.total <= 0) return;
    const goodFrac = stats.good / stats.total;
    const damagedFrac = (stats.failed + stats.skipped) / stats.total;
    const scannedFrac = (stats.good + stats.failed + stats.skipped) / stats.total;
    // Milestone — every 10% recovered crossing
    const tier = Math.floor(goodFrac * 10);
    if (lastMilestoneTierRef.current >= 0 && tier > lastMilestoneTierRef.current && tier > 0) {
      audio.play("milestone");
    }
    lastMilestoneTierRef.current = tier;
    // Ring completion — each of the three rings hitting 100%
    const fired = lastRingTiersRef.current;
    if (!fired.recovered && goodFrac >= 0.999) {
      audio.play("ring_complete");
      fired.recovered = true;
    }
    if (!fired.damaged && damagedFrac >= 0.999) {
      audio.play("ring_complete");
      fired.damaged = true;
    }
    if (!fired.scanned && scannedFrac >= 0.999) {
      audio.play("ring_complete");
      fired.scanned = true;
    }
    // Drive warning — fire once when health flips to "suspect"
    const health = stats.drive_health;
    if (
      health === "suspect" &&
      lastDriveHealthRef.current !== "suspect"
    ) {
      audio.play("drive_warning");
    }
    lastDriveHealthRef.current = health;
  }, [stats]);

  const idle = now - lastProgressAt > 5000;

  const resume = async () => {
    if (!id) return;
    setResuming(true);
    setResumeError(null);
    setRecoveryDone(false);
    try {
      await ipc.startRecovery(id, resumeMode);
      try { localStorage.setItem(`mode:${id}`, resumeMode); } catch { /* ignore */ }
      setLastProgressAt(Date.now());
    } catch (e) {
      setResumeError(String(e));
    } finally {
      setResuming(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const tick = async () => {
      try {
        const buckets = await ipc.getSectorMap(id, 4096);
        setBucketRow(buckets);
      } catch {
        /* ignore until session exists */
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [id]);

  // Page entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      headingReveal(headingRef.current);
      staggerReveal(scopeRef, "[data-stagger='top']", { delay: 0.2, y: 12 });
      staggerReveal(scopeRef, "[data-stagger='stat']", {
        delay: 0.35,
        stagger: 0.08,
      });
      staggerReveal(scopeRef, "[data-stagger='hero']", { delay: 0.25, y: 20 });
    }, scopeRef);
    return () => ctx.revert();
  }, []);

  if (!id) return null;

  const headline = recoveryDone
    ? "All saved"
    : idle
      ? "Resting the drive"
      : "Saving your video…";
  const subline = stats
    ? progressSentence({ good: stats.good, total: stats.total })
    : "Getting ready — listening for your disc…";

  const isActive = !idle && !recoveryDone;
  const total = stats?.total ?? 0;
  const scanned = stats ? stats.good + stats.failed + stats.skipped : 0;
  const pct = total > 0 ? (stats!.good / total) * 100 : 0;
  const scannedPct = total > 0 ? (scanned / total) * 100 : 0;

  return (
    <div ref={scopeRef} className="flex flex-1 h-full overflow-hidden">
      {/* ── LEFT: recovery progress ── */}
      <div className="flex-1 overflow-y-auto px-5 py-3 min-w-0">
      <header className="mb-3 flex items-start justify-between gap-4" data-stagger="top">
        <div>
          <span className="micro-label">Active session</span>
          <h1
            ref={headingRef}
            className="mt-1 font-display text-[22px] font-semibold leading-tight tracking-tightish text-ink-900"
          >
            {headline}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-500">{subline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!recoveryDone && idle && (
            <>
              <select
                value={resumeMode}
                onChange={(e) => setResumeMode(e.target.value as RecoveryMode)}
                disabled={resuming}
                className="rounded-full border border-ink-200 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-brand-300 focus:border-brand-400 focus:outline-none transition-colors"
                title={
                  resumeMode === "patient"
                    ? "Patient mode: 2s rest between reads, kind to bus-powered drives. Slow but stable."
                    : "Standard mode: balanced. Best for healthy drives."
                }
              >
                <option value="standard">Standard</option>
                <option value="patient">Patient</option>
              </select>
              <button className="btn btn-primary" onClick={resume} disabled={resuming}>
                {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Resume
              </button>
            </>
          )}
          {!recoveryDone && !idle && (
            <button className="btn btn-ghost" onClick={() => ipc.pauseRecovery(id)}>
              <Pause className="h-4 w-4" /> Pause
            </button>
          )}
          {!recoveryDone && (
            <button className="btn btn-danger" onClick={() => ipc.cancelRecovery(id)}>
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
          {recoveryDone && stats && stats.failed > 0 && (
            <button
              className="btn btn-ghost"
              disabled={resuming}
              title="Re-reads failed sectors using Patient mode — slower but gentler on the drive."
              onClick={async () => {
                setResuming(true);
                setResumeError(null);
                setRecoveryDone(false);
                try {
                  await ipc.startRecovery(id, "patient");
                  setLastProgressAt(Date.now());
                } catch (e) {
                  setResumeError(String(e));
                } finally {
                  setResuming(false);
                }
              }}
            >
              {resuming
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              Retry {stats.failed.toLocaleString()} failed sector{stats.failed === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </header>

      {/* Drive switch panel */}
      {(idle || recoveryDone) && (
        <div className="mb-3" data-stagger="top">
          <button
            className="text-[12px] font-medium text-ink-500 hover:text-brand-600"
            onClick={async () => {
              setDriveSwitchMsg(null);
              if (!showDrivePicker) {
                try {
                  setDrives(await ipc.listDrives());
                } catch (e) {
                  setDriveSwitchMsg(String(e));
                }
              }
              setShowDrivePicker(!showDrivePicker);
            }}
          >
            <RefreshCw className="mr-1 inline h-3 w-3" />
            {showDrivePicker ? "Hide" : "Try a different drive"}
          </button>
          {showDrivePicker && (
            <div className="card mt-3 p-4">
              <p className="mb-3 text-[12px] text-ink-500">
                Different DVD drives often succeed where another fails — different
                optics, different read tolerances. Pick a drive and resume to retry
                damaged areas.
              </p>
              {drives.length === 0 ? (
                <p className="text-[12px] text-ink-500">No other drives detected.</p>
              ) : (
                <ul className="space-y-1">
                  {drives.map((d) => {
                    const friendly = [d.vendor, d.model]
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0 && s.toLowerCase() !== "unknown")
                      .join(" ");
                    return (
                      <li key={d.path}>
                        <button
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12.5px] text-ink-700 transition hover:bg-brand-50"
                          onClick={async () => {
                            try {
                              await ipc.changeDrive(id, d.path);
                              setDriveSwitchMsg(
                                `Switched to ${friendly || d.letter}. Click Resume to retry damaged areas with this drive.`,
                              );
                              setShowDrivePicker(false);
                            } catch (e) {
                              setDriveSwitchMsg(String(e));
                            }
                          }}
                        >
                          <span className="text-ink-900">
                            {friendly || `Drive ${d.letter}`}
                          </span>
                          <span className="text-ink-500">
                            {d.has_media ? "disc inserted" : "empty"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {driveSwitchMsg && (
            <p className="mt-2 text-[12px] text-ios-green">{driveSwitchMsg}</p>
          )}
        </div>
      )}
      {resumeError && (() => {
        const fe = friendlyError(resumeError);
        return (
          <div
            className="mb-4 rounded-xl border border-ios-red/25 bg-ios-red/5 px-4 py-3"
            role="alert"
          >
            <div className="text-[13px] font-medium text-ink-900">
              {fe.headline}
            </div>
            {fe.hint && (
              <div className="mt-1 text-[12px] leading-relaxed text-ink-500">
                {fe.hint}
              </div>
            )}
          </div>
        );
      })()}

      <DriveHealthBanner stats={stats} />

      {/* HERO: Disc animation with editorial watermark */}
      <div className="card mb-3 overflow-hidden relative px-4 py-3" data-stagger="hero">
        {/* Masthead mark — top-right corner */}
        <div className="absolute right-5 top-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-ink-400">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="6" fill="none" stroke="#0A84FF" strokeWidth="1" />
            <circle cx="7" cy="7" r="2" fill="#0A84FF" />
          </svg>
          <span>No. {(id ?? "").slice(0, 6).toUpperCase() || "—"}</span>
        </div>

        {/* Ghost watermark — recovered minutes as oversized number behind disc */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        >
          <span
            className="font-display tabular-nums"
            style={{
              fontSize: "min(28vw, 320px)",
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: "-0.06em",
              color: "transparent",
              WebkitTextStroke: "1px rgba(10,23,41,0.04)",
              transform: "translateX(-22%)",
            }}
          >
            {sectorsToMinutes(stats?.good ?? 0)}
          </span>
        </div>

        <div className="relative grid grid-cols-1 gap-5 md:grid-cols-[auto,1fr] md:items-center">
          <div className="flex flex-col items-center md:items-start gap-3">
            <DiscVariantRenderer
              variant={discVariant}
              buckets={bucketRow}
              totalSectors={total}
              isActive={isActive}
              pct={pct}
              stats={
                stats
                  ? {
                      good: stats.good,
                      failed: stats.failed,
                      skipped: stats.skipped,
                      unknown: stats.unknown,
                    }
                  : null
              }
            />
            <DiscVariantPicker value={discVariant} onChange={onDiscVariantChange} />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <span className="micro-label">Pass strategy</span>
              <p className="mt-0.5 font-display text-[18px] font-semibold tracking-[-0.025em] leading-[1.15] text-ink-900">
                {prettyPass(stats)}
              </p>
            </div>
            {/* Hairline stat row — horizontal 4-up to save vertical space */}
            <dl className="grid grid-cols-4 gap-x-4 gap-y-2 border-t border-ink-200/70 pt-3">
              <HairlineStat
                label="Scanned"
                value={`${scannedPct.toFixed(0)}%`}
              />
              <HairlineStat
                label="Speed"
                value={
                  stats?.speed_sps !== undefined
                    ? `${((stats.speed_sps * 2048) / 1024 / 1024).toFixed(2)}`
                    : "—"
                }
                unit={stats?.speed_sps !== undefined ? "MB/s" : undefined}
              />
              <HairlineStat
                label="Elapsed"
                value={
                  stats?.elapsed_secs !== undefined && stats.elapsed_secs > 0
                    ? durationHuman(stats.elapsed_secs)
                    : "—"
                }
              />
              <HairlineStat
                label="Remaining"
                value={stats?.eta_secs != null ? durationHuman(stats.eta_secs) : "—"}
              />
            </dl>
          </div>
        </div>
      </div>

      {/* Editorial stat row — hairline dividers, no boxes */}
      <div className="grid grid-cols-1 divide-y divide-ink-200/70 border-y border-ink-200/70 md:grid-cols-3 md:divide-x md:divide-y-0">
        <BigStat
          dataAttr="stat"
          label="Recovered"
          minutes={sectorsToMinutes(stats?.good ?? 0)}
          subline={bytesToHuman(sectorsToBytes(stats?.good ?? 0))}
          tone="success"
          loading={!stats}
        />
        <BigStat
          dataAttr="stat"
          label="Damaged"
          minutes={sectorsToMinutes((stats?.failed ?? 0) + (stats?.skipped ?? 0))}
          subline={
            (stats?.failed ?? 0) + (stats?.skipped ?? 0) > 0
              ? "we'll retry these"
              : "none yet"
          }
          tone={(stats?.failed ?? 0) + (stats?.skipped ?? 0) > 0 ? "warn" : "muted"}
          loading={!stats}
        />
        <BigStat
          dataAttr="stat"
          label="Pending"
          minutes={sectorsToMinutes(stats?.unknown ?? 0)}
          subline="not yet read"
          tone="muted"
          loading={!stats}
        />
      </div>

      <details className="card mt-3 px-4 py-2.5 group">
        <summary className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-500 list-none select-none">
          <Activity className="h-4 w-4 text-brand-500" />
          <span className="text-ink-900 font-medium">Sector map</span>
          {stats && stats.total > 0 && (
            <span className="ml-auto text-[12px] text-ink-500">
              {(((stats.good + stats.failed + stats.skipped) / stats.total) * 100).toFixed(0)}%
              scanned
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-ink-400 transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3">
          <SectorMapCanvas buckets={bucketRow} />
          {stats && (
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-[12px] text-ink-700">
              <span>Good: {stats.good.toLocaleString()}</span>
              <span>Failed: {stats.failed.toLocaleString()}</span>
              <span>Skipped: {stats.skipped.toLocaleString()}</span>
              <span>Pending: {stats.unknown.toLocaleString()}</span>
              <span>Total: {stats.total.toLocaleString()}</span>
              <span>Pass: {stats.pass_strategy}</span>
            </div>
          )}
        </div>
      </details>

      {recoveryDone && <DoneBanner stats={stats} />}
      </div>{/* end left column */}

      {/* ── RIGHT: save panel ── */}
      <div
        className="w-72 shrink-0 overflow-y-auto border-l border-ink-200/70 bg-white/30"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <OutputPanel sessionId={id} />
      </div>
    </div>
  );
}

function HairlineStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1 font-display text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-ink-900">
        <span>{value}</span>
        {unit && (
          <span className="text-[12px] font-medium text-ink-500">{unit}</span>
        )}
      </dd>
    </div>
  );
}

function prettyPass(stats: RecoveryStats | null): string {
  if (!stats) return "Getting ready…";
  switch (stats.pass_strategy) {
    case "Fast Triage":
      return "Reading the disc";
    case "Slow Read":
      return "Retrying damaged areas (slower)";
    case "Reverse Read":
      return "Retrying from the other end";
    case "Thermal Pause":
      return "Final retry after a cool-down pause";
    case "Zero Fill":
      return "Marking unreadable areas";
    default:
      return stats.pass_strategy;
  }
}

function DoneBanner({ stats }: { stats: RecoveryStats | null }) {
  const ref = useRef<HTMLDivElement>(null);

  // Determine tone before the early return so hooks always run in the same order.
  const recoveredMin = stats ? sectorsToMinutes(stats.good) : 0;
  const damagedMin = stats
    ? sectorsToMinutes(stats.failed + stats.skipped)
    : 0;
  const totalMin = stats ? sectorsToMinutes(stats.total) : 0;

  let tone: "success" | "partial" | "rough" = "rough";
  let headline = "";
  let detail = "";

  if (stats) {
    if (damagedMin === 0) {
      tone = "success";
      headline = `We saved everything — ${recoveredMin} minutes recovered.`;
      detail =
        "Use the buttons below to save it as a video file or extract individual chapters.";
    } else if (recoveredMin > damagedMin * 3) {
      tone = "partial";
      headline = `We saved ${recoveredMin} of ${totalMin} minutes.`;
      detail = `${damagedMin} minutes had damage we couldn't read. Sometimes a second try in a different drive helps.`;
    } else if (recoveredMin > 0) {
      tone = "rough";
      headline = `This disc is heavily damaged.`;
      detail = `We got ${recoveredMin} minutes of usable video. Even professional services often can't do better. You can keep this and try a different drive.`;
    } else {
      tone = "rough";
      headline = "We weren't able to read this disc.";
      detail =
        "The drive couldn't read enough to recover usable video. Try cleaning the disc, or use a different DVD drive.";
    }
  }

  // Celebration: pulse-in for every completion; sparkle burst only for full success.
  useEffect(() => {
    if (!stats) return;
    pulseIn(ref.current);
    if (tone === "success") {
      // Brief delay so sparkles read as a *response* to the banner appearing.
      const t = window.setTimeout(() => sparkleBurst(ref.current, 16), 220);
      return () => window.clearTimeout(t);
    }
  }, [stats, tone]);

  if (!stats) return null;

  const styles =
    tone === "success"
      ? {
          background:
            "linear-gradient(135deg, rgba(52,199,89,0.12) 0%, rgba(52,199,89,0.06) 100%)",
          border: "1px solid rgba(52,199,89,0.30)",
          color: "#0A1729",
        }
      : tone === "partial"
        ? {
            background:
              "linear-gradient(135deg, rgba(255,149,0,0.12) 0%, rgba(255,149,0,0.06) 100%)",
            border: "1px solid rgba(255,149,0,0.30)",
            color: "#0A1729",
          }
        : {
            background: "rgba(255,255,255,0.72)",
            border: "1px solid #E1E6EE",
            color: "#0A1729",
          };

  return (
    <div ref={ref} className="relative mt-6 rounded-2xl p-5" style={styles}>
      <div className="flex items-start gap-3">
        <Disc3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <h3 className="font-display text-[17px] font-semibold tracking-tightish">
            {headline}
          </h3>
          <p className="mt-1 text-[13.5px] opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Surfaces the recovery engine's drive-health hint. Shows up only when the
 * drive looks suspect (no successful reads after enough attempts) — otherwise
 * stays out of the way. Helps users tell "the disc is damaged" apart from
 * "the drive is broken/disconnecting" without reading log files.
 */
function DriveHealthBanner({ stats }: { stats: RecoveryStats | null }) {
  if (!stats) return null;
  const { drive_health, reads_ok, reads_err, idle_secs } = stats;
  if (drive_health !== "suspect") return null;

  const attempts = reads_ok + reads_err;
  const idleMin = idle_secs ? Math.floor(idle_secs / 60) : 0;

  let detail: string;
  if (reads_ok === 0) {
    detail = `We've tried ${attempts.toLocaleString()} sector reads and none have succeeded. The disc might be unreadable in this drive — try a different DVD drive, a powered USB hub, or a different USB port.`;
  } else if (idleMin >= 2) {
    detail = `No successful reads in ${idleMin} minute${idleMin === 1 ? "" : "s"}. The drive may have stopped responding — check the cable, try a different USB port, or try a different drive.`;
  } else {
    detail =
      "Almost no reads are succeeding. This usually means the disc can't be read in this drive — a different DVD drive often helps.";
  }

  return (
    <div
      className="mb-3 rounded-2xl p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,59,48,0.10) 0%, rgba(255,59,48,0.04) 100%)",
        border: "1px solid rgba(255,59,48,0.30)",
      }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Disc3 className="mt-0.5 h-5 w-5 shrink-0 text-ios-red" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[15px] font-semibold tracking-tightish text-ink-900">
            The drive may not be reading this disc
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  minutes,
  subline,
  tone,
  dataAttr,
  loading = false,
}: {
  label: string;
  minutes: number;
  subline: string;
  tone: "success" | "warn" | "muted";
  dataAttr?: string;
  loading?: boolean;
}) {
  const numRef = useRef<HTMLSpanElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const lastTargetRef = useRef<number>(-1);

  // Count-up animation when value changes (only after data arrives).
  useEffect(() => {
    if (loading) return;
    if (lastTargetRef.current === minutes) return;
    lastTargetRef.current = minutes;
    countUp(numRef.current, minutes, 1.0);
  }, [minutes, loading]);

  // Soft shimmer while waiting for first stats — signals "we're listening,
  // not stuck" without screaming for attention.
  useEffect(() => {
    if (!loading) return;
    const stop = startShimmer(groupRef.current);
    return stop;
  }, [loading]);

  const color =
    tone === "success"
      ? "text-ios-green"
      : tone === "warn"
        ? "text-ios-orange"
        : "text-ink-700";

  return (
    <div className="px-5 py-3 first:pl-0 md:px-6" data-stagger={dataAttr}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="micro-label">{label}</div>
        <div className="text-[11px] text-ink-500">{subline}</div>
      </div>
      <div
        ref={groupRef}
        className={`mt-1 flex items-baseline gap-1.5 font-display tracking-[-0.035em] ${color}`}
      >
        <span
          ref={numRef}
          className="text-[28px] font-semibold tabular-nums leading-none"
        >
          {loading ? "—" : "0"}
        </span>
        <span className="text-[12px] font-medium text-ink-500">min</span>
      </div>
    </div>
  );
}
