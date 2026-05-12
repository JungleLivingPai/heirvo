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
 * ActivityRingMeditative — the "ocean floor" variant of ActivityRing.
 *
 * Same three-ring structure (Recovered / Damaged / Scanned) as the baseline,
 * but the entire visualization breathes. Designed for someone who sets a
 * recovery running and walks away for hours: nothing draws your eye, nothing
 * celebrates, nothing demands. Three breath periods (3.6s / 4.4s / 5.2s) drift
 * out of phase like overlapping wave systems. A blurred halo behind the rings
 * swells and dims on a slow tide (~7s). Each gradient angle slowly rotates
 * over ~28s. When the rings fill, they do not flash — they exhale.
 */
export default function ActivityRingMeditative({
  totalSectors,
  isActive,
  pct,
  stats,
}: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const breath1Ref = useRef<SVGGElement>(null);
  const breath2Ref = useRef<SVGGElement>(null);
  const breath3Ref = useRef<SVGGElement>(null);
  const recoveredRef = useRef<SVGCircleElement>(null);
  const damagedRef = useRef<SVGCircleElement>(null);
  const scannedRef = useRef<SVGCircleElement>(null);
  const grad1Ref = useRef<SVGLinearGradientElement>(null);
  const grad2Ref = useRef<SVGLinearGradientElement>(null);
  const grad3Ref = useRef<SVGLinearGradientElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);
  const completedRef = useRef<boolean>(false);

  // Derive the three fractions. Prefer real stats; fall back to pct-only mode.
  const total = stats && totalSectors > 0 ? totalSectors : Math.max(totalSectors, 1);
  const goodFrac = stats ? stats.good / total : pct / 100;
  const damagedFrac = stats ? (stats.failed + stats.skipped) / total : 0;
  const scannedFrac = stats
    ? (stats.good + stats.failed + stats.skipped) / total
    : pct / 100;

  // Three ring radii.
  const STROKE = 14;
  const GAP = 6;
  const r1 = C - STROKE / 2 - 6;
  const r2 = r1 - STROKE - GAP;
  const r3 = r2 - STROKE - GAP;
  const circ = (r: number) => 2 * Math.PI * r;

  // Smoothly write the dasharray on stat updates — slower, softer than baseline.
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
        duration: 1.8,
        ease: "sine.inOut",
      });
    });
  }, [goodFrac, damagedFrac, scannedFrac, r1, r2, r3]);

  // Slow percent count-up — long, gentle, never grabs attention.
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
      duration: 1.8,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(obj.v)}`;
      },
    });
  }, [pct]);

  // Persistent ambient breath — three rings, three periods, slightly out of phase.
  // Tide halo behind the rings. Color drift on each gradient.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!scopeRef.current) return;

    const ctx = gsap.context(() => {
      // --- Breathing: each ring scales ±2-3% and dims ±10%, sine eased.
      const breaths: [SVGGElement | null, number][] = [
        [breath1Ref.current, 3.6],
        [breath2Ref.current, 4.4],
        [breath3Ref.current, 5.2],
      ];
      breaths.forEach(([el, period], i) => {
        if (!el) return;
        // Out-of-phase starting offsets so the three never align.
        gsap.set(el, { transformOrigin: "50% 50%" });
        gsap.fromTo(
          el,
          { scale: 0.978, opacity: 0.92 },
          {
            scale: 1.022,
            opacity: 1.0,
            duration: period / 2,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: i * 0.35,
          }
        );
      });

      // --- Tide halo: slow swell + dim over 7s, longer than any breath.
      if (haloRef.current) {
        gsap.fromTo(
          haloRef.current,
          { scale: 0.92, opacity: 0.35 },
          {
            scale: 1.06,
            opacity: 0.7,
            duration: 3.5,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            transformOrigin: "50% 50%",
          }
        );
      }

      // --- Color drift: rotate each gradient direction over ~28s.
      // We animate a proxy { a: angleRadians } and write x1/y1/x2/y2 from it.
      const gradients: [SVGLinearGradientElement | null, number, number][] = [
        [grad1Ref.current, 28, 0],
        [grad2Ref.current, 32, Math.PI / 3],
        [grad3Ref.current, 26, (2 * Math.PI) / 3],
      ];
      gradients.forEach(([g, period, phase]) => {
        if (!g) return;
        const proxy = { a: phase };
        gsap.to(proxy, {
          a: phase + Math.PI * 2,
          duration: period,
          ease: "none",
          repeat: -1,
          onUpdate: () => {
            // Map angle to a unit-square gradient direction.
            const cx = 0.5 + 0.5 * Math.cos(proxy.a);
            const cy = 0.5 + 0.5 * Math.sin(proxy.a);
            g.setAttribute("x1", `${1 - cx}`);
            g.setAttribute("y1", `${1 - cy}`);
            g.setAttribute("x2", `${cx}`);
            g.setAttribute("y2", `${cy}`);
          },
        });
      });
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  // Gentle "exhale" when the recovery completes — no burst, just one long sigh.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!scopeRef.current) return;
    const justCompleted = scannedFrac >= 0.999 && !completedRef.current;
    if (!justCompleted) return;
    completedRef.current = true;

    const ctx = gsap.context(() => {
      gsap.to(haloRef.current, {
        opacity: 0.85,
        scale: 1.12,
        duration: 4.5,
        ease: "sine.out",
        yoyo: true,
        repeat: 1,
      });
    }, scopeRef);
    return () => ctx.revert();
  }, [scannedFrac]);

  // Live readouts in minutes
  const goodMin = stats ? sectorsToMinutes(stats.good) : Math.round((pct / 100) * sectorsToMinutes(totalSectors));
  const damagedMin = stats
    ? sectorsToMinutes(stats.failed + stats.skipped)
    : 0;
  const pendingMin = stats
    ? sectorsToMinutes(stats.unknown)
    : sectorsToMinutes(totalSectors) - goodMin;

  // Idle vs active is intentionally a near-no-op: the meditative variant
  // breathes the same whether or not the drive is reading. We just lift the
  // halo a touch when active so there's a faint sense of presence.
  const haloIntensity = isActive ? 1 : 0.7;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={scopeRef}
        className="relative"
        style={{ width: SIZE, height: SIZE }}
        aria-hidden
      >
        {/* Deep oceanic backdrop */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, #16223D 0%, #0A1628 65%, #050B1A 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 36px -12px rgba(8,18,34,0.6)",
          }}
        />

        {/* Tidal halo — blurred radial swell behind the rings */}
        <div
          ref={haloRef}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(90,200,250,0.32) 0%, rgba(52,199,138,0.14) 45%, rgba(10,132,255,0.0) 75%)",
            filter: "blur(18px)",
            opacity: 0.5 * haloIntensity,
            mixBlendMode: "screen",
          }}
        />

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative"
        >
          <defs>
            {/* Recovered — soft aqua → sea-foam */}
            <linearGradient
              ref={grad1Ref}
              id="arm-recovered"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#7FD4F5" />
              <stop offset="100%" stopColor="#5EC4A8" />
            </linearGradient>
            {/* Damaged — muted coral, never alarming */}
            <linearGradient
              ref={grad2Ref}
              id="arm-damaged"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#F5C56B" />
              <stop offset="100%" stopColor="#E89178" />
            </linearGradient>
            {/* Scanned — dusk indigo → twilight blue */}
            <linearGradient
              ref={grad3Ref}
              id="arm-scanned"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#4A7DC4" />
              <stop offset="100%" stopColor="#7FB6E6" />
            </linearGradient>
          </defs>

          {/* Track rings — extra dim, almost vanishing into the deep */}
          <circle
            cx={C}
            cy={C}
            r={r1}
            fill="none"
            stroke="rgba(127,212,245,0.07)"
            strokeWidth={STROKE}
          />
          <circle
            cx={C}
            cy={C}
            r={r2}
            fill="none"
            stroke="rgba(245,197,107,0.06)"
            strokeWidth={STROKE}
          />
          <circle
            cx={C}
            cy={C}
            r={r3}
            fill="none"
            stroke="rgba(74,125,196,0.07)"
            strokeWidth={STROKE}
          />

          {/* Active rings, each wrapped in a <g> we can scale/breathe independently */}
          <g ref={breath1Ref}>
            <circle
              ref={recoveredRef}
              cx={C}
              cy={C}
              r={r1}
              fill="none"
              stroke="url(#arm-recovered)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r1)}`}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </g>
          <g ref={breath2Ref}>
            <circle
              ref={damagedRef}
              cx={C}
              cy={C}
              r={r2}
              fill="none"
              stroke="url(#arm-damaged)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r2)}`}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </g>
          <g ref={breath3Ref}>
            <circle
              ref={scannedRef}
              cx={C}
              cy={C}
              r={r3}
              fill="none"
              stroke="url(#arm-scanned)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r3)}`}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </g>
        </svg>

        {/* Center % readout — same anchor as baseline, softer typography weight */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-[10px] uppercase tracking-[0.20em] text-white/45">
            Recovered
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span
              ref={pctRef}
              className="font-display text-[40px] font-light tabular-nums leading-none text-white/95"
              style={{ letterSpacing: "-0.025em" }}
            >
              0
            </span>
            <span className="text-[15px] font-light text-white/55">%</span>
          </div>
        </div>
      </div>

      {/* Live readout legend — minutes by category */}
      <div className="flex items-center gap-3 text-[11px]">
        <Legend
          colorClass="bg-[#5EC4A8]"
          label="Saved"
          value={`${goodMin}m`}
        />
        <span className="text-ink-300">·</span>
        <Legend
          colorClass="bg-[#E89178]"
          label="Damaged"
          value={`${damagedMin}m`}
          dimmed={damagedMin === 0}
        />
        <span className="text-ink-300">·</span>
        <Legend
          colorClass="bg-[#4A7DC4]"
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
    <div
      className={`inline-flex items-center gap-1.5 ${dimmed ? "opacity-50" : ""}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${colorClass}`} />
      <span className="text-ink-500">{label}</span>
      <span className="font-display tabular-nums font-medium text-ink-900">
        {value}
      </span>
    </div>
  );
}
