import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "@/utils/gsap-fx";
import { sectorsToMinutes } from "@/lib/human";
import type { VariantStats } from "./index";

interface Props {
  buckets: number[];
  totalSectors: number;
  isActive: boolean;
  pct: number;
  /**
   * Real per-state sector counts. When provided, the three rings represent
   * Recovered / Damaged / Total-Scanned with truthful proportions.
   */
  stats?: VariantStats | null;
}

const SIZE = 240;
const C = SIZE / 2;

/**
 * ActivityRing — Apple Watch Move/Exercise/Stand inspired visualization,
 * grounded in real recovery telemetry.
 *
 * Three concentric rings on a deep navy backdrop:
 *   - Outer (thickest): Recovered = good / total — cyan→green like "Move"
 *   - Middle: Damaged = (failed + skipped) / total — orange like "Exercise"
 *   - Inner: Scanned = (good + failed + skipped) / total — blue like "Stand"
 *     This third ring shows how far we've made it through the disc; when
 *     it completes, the recovery is finished.
 *
 * Below the rings: live minutes-recovered / damaged / pending readouts so
 * the user sees the *actual* numbers, not just abstract proportions.
 */
export default function ActivityRing({
  totalSectors,
  isActive,
  pct,
  stats,
}: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const recoveredRef = useRef<SVGCircleElement>(null);
  const damagedRef = useRef<SVGCircleElement>(null);
  const scannedRef = useRef<SVGCircleElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

  // Derive the three fractions. Prefer real stats; fall back to pct-only mode.
  const total = stats && totalSectors > 0 ? totalSectors : Math.max(totalSectors, 1);
  const goodFrac = stats ? stats.good / total : pct / 100;
  const damagedFrac = stats
    ? (stats.failed + stats.skipped) / total
    : 0;
  const scannedFrac = stats
    ? (stats.good + stats.failed + stats.skipped) / total
    : pct / 100;

  // Three ring radii — outer biggest, inner smallest.
  const STROKE = 14;
  const GAP = 6;
  const r1 = C - STROKE / 2 - 6; // Recovered (outer)
  const r2 = r1 - STROKE - GAP; // Damaged (middle)
  const r3 = r2 - STROKE - GAP; // Scanned (inner)
  const circ = (r: number) => 2 * Math.PI * r;

  useEffect(() => {
    const ringConfigs: [SVGCircleElement | null, number, number][] = [
      [recoveredRef.current, Math.min(1, goodFrac), r1],
      [damagedRef.current, Math.min(1, damagedFrac), r2],
      [scannedRef.current, Math.min(1, scannedFrac), r3],
    ];
    ringConfigs.forEach(([el, frac, r]) => {
      if (!el) return;
      const c = circ(r);
      const dash = c * frac;
      if (prefersReducedMotion()) {
        el.style.strokeDasharray = `${dash} ${c - dash}`;
        return;
      }
      gsap.to(el, {
        attr: { "stroke-dasharray": `${dash} ${c - dash}` },
        duration: 0.9,
        ease: "power3.out",
      });
    });
  }, [goodFrac, damagedFrac, scannedFrac, r1, r2, r3]);

  // Smooth count-up of the percent display
  useEffect(() => {
    const el = pctRef.current;
    if (!el) return;
    if (Math.abs(pct - lastPctRef.current) < 0.05) return;
    lastPctRef.current = pct;
    if (prefersReducedMotion()) {
      el.textContent = `${Math.round(pct)}`;
      return;
    }
    const start = parseFloat(el.textContent || "0");
    const obj = { v: Number.isFinite(start) ? start : 0 };
    gsap.to(obj, {
      v: pct,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(obj.v)}`;
      },
    });
  }, [pct]);

  // Subtle "achievement" pulse glow when active
  useEffect(() => {
    if (prefersReducedMotion() || !isActive) return;
    if (!scopeRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to([recoveredRef.current, damagedRef.current, scannedRef.current], {
        filter: "drop-shadow(0 0 5px currentColor)",
        duration: 1.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.2,
      });
    }, scopeRef);
    return () => ctx.revert();
  }, [isActive]);

  // Live readouts in minutes
  const goodMin = stats ? sectorsToMinutes(stats.good) : Math.round((pct / 100) * sectorsToMinutes(totalSectors));
  const damagedMin = stats
    ? sectorsToMinutes(stats.failed + stats.skipped)
    : 0;
  const pendingMin = stats
    ? sectorsToMinutes(stats.unknown)
    : sectorsToMinutes(totalSectors) - goodMin;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={scopeRef}
        className="relative"
        style={{ width: SIZE, height: SIZE }}
        aria-hidden
      >
        {/* Deep navy backdrop with subtle gradient */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, #1A2540 0%, #0A1729 70%, #04091A 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 36px -12px rgba(10,23,41,0.55)",
          }}
        />

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative"
        >
          <defs>
            {/* Recovered ring — cyan→green gradient like "Move" */}
            <linearGradient id="ar-recovered" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5AC8FA" />
              <stop offset="100%" stopColor="#34C759" />
            </linearGradient>
            {/* Damaged — warm orange gradient like "Exercise" */}
            <linearGradient id="ar-damaged" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFD60A" />
              <stop offset="100%" stopColor="#FF3B30" />
            </linearGradient>
            {/* Scanned (inner) — cool blue like "Stand" */}
            <linearGradient id="ar-scanned" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#5AC8FA" />
            </linearGradient>
          </defs>

          {/* Track rings (always full circle, dim) */}
          <circle
            cx={C}
            cy={C}
            r={r1}
            fill="none"
            stroke="rgba(90,200,250,0.10)"
            strokeWidth={STROKE}
          />
          <circle
            cx={C}
            cy={C}
            r={r2}
            fill="none"
            stroke="rgba(255,149,0,0.10)"
            strokeWidth={STROKE}
          />
          <circle
            cx={C}
            cy={C}
            r={r3}
            fill="none"
            stroke="rgba(10,132,255,0.10)"
            strokeWidth={STROKE}
          />

          {/* Active rings */}
          <circle
            ref={recoveredRef}
            cx={C}
            cy={C}
            r={r1}
            fill="none"
            stroke="url(#ar-recovered)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`0 ${circ(r1)}`}
            transform={`rotate(-90 ${C} ${C})`}
            style={{ color: "#34C759" }}
          />
          <circle
            ref={damagedRef}
            cx={C}
            cy={C}
            r={r2}
            fill="none"
            stroke="url(#ar-damaged)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`0 ${circ(r2)}`}
            transform={`rotate(-90 ${C} ${C})`}
            style={{ color: "#FF9500" }}
          />
          <circle
            ref={scannedRef}
            cx={C}
            cy={C}
            r={r3}
            fill="none"
            stroke="url(#ar-scanned)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`0 ${circ(r3)}`}
            transform={`rotate(-90 ${C} ${C})`}
            style={{ color: "#0A84FF" }}
          />
        </svg>

        {/* Center % readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-[10px] uppercase tracking-[0.20em] text-white/55">
            Recovered
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span
              ref={pctRef}
              className="font-display text-[40px] font-semibold tabular-nums leading-none text-white"
              style={{ letterSpacing: "-0.025em" }}
            >
              0
            </span>
            <span className="text-[15px] font-semibold text-white/70">%</span>
          </div>
        </div>
      </div>

      {/* Live readout legend — minutes by category */}
      <div className="flex items-center gap-3 text-[11px]">
        <Legend
          colorClass="bg-[#34C759]"
          label="Saved"
          value={`${goodMin}m`}
        />
        <span className="text-ink-300">·</span>
        <Legend
          colorClass="bg-[#FF9500]"
          label="Damaged"
          value={`${damagedMin}m`}
          dimmed={damagedMin === 0}
        />
        <span className="text-ink-300">·</span>
        <Legend
          colorClass="bg-[#0A84FF]"
          label="Pending"
          value={`${pendingMin}m`}
          dimmed={pendingMin === 0}
        />
      </div>
    </div>
  );
}

function Legend({
  colorClass,
  label,
  value,
  dimmed = false,
}: {
  colorClass: string;
  label: string;
  value: string;
  dimmed?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${dimmed ? "opacity-50" : ""}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${colorClass}`} />
      <span className="text-ink-500">{label}</span>
      <span className="font-display tabular-nums font-semibold text-ink-900">
        {value}
      </span>
    </div>
  );
}
