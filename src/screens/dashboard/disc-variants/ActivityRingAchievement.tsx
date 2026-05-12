import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion, sparkleBurst } from "@/utils/gsap-fx";
import { sectorsToMinutes } from "@/lib/human";
import type { VariantStats } from "./index";

interface Props {
  buckets: number[];
  totalSectors: number;
  isActive: boolean;
  pct: number;
  stats?: VariantStats | null;
}

const SIZE = 240;
const C = SIZE / 2;

/**
 * ActivityRingAchievement — gamified "close your rings" variant.
 *
 * Apple Watch fitness inspired:
 *   - Snappy power4.out tweens (0.4s) — decisive, not soothing.
 *   - Static at rest. Animates only when something happens.
 *   - 10% milestone glow flashes + floating "+10%" labels.
 *   - 100% completion bursts (12 sparkles) + back.out(2) ring scale pop.
 *   - Slot-machine digit roll for the center % readout.
 *   - Streak indicator if Recovered grows without Damaged growth.
 *   - Tinted achievement haze that brightens on each milestone.
 */
export default function ActivityRingAchievement({
  totalSectors,
  isActive,
  pct,
  stats,
}: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const recoveredRef = useRef<SVGCircleElement>(null);
  const damagedRef = useRef<SVGCircleElement>(null);
  const scannedRef = useRef<SVGCircleElement>(null);
  const recoveredGroupRef = useRef<SVGGElement>(null);
  const damagedGroupRef = useRef<SVGGElement>(null);
  const scannedGroupRef = useRef<SVGGElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const burstHostRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const goodMinRef = useRef<HTMLSpanElement>(null);
  const damagedMinRef = useRef<HTMLSpanElement>(null);
  const pendingMinRef = useRef<HTMLSpanElement>(null);

  const lastPctRef = useRef<number>(-1);
  const lastGoodFracRef = useRef<number>(0);
  const lastDamagedFracRef = useRef<number>(0);
  const lastScannedFracRef = useRef<number>(0);
  const lastGoodMinRef = useRef<number>(0);
  const lastDamagedMinRef = useRef<number>(-1);
  const lastPendingMinRef = useRef<number>(-1);
  const streakActiveRef = useRef<boolean>(false);

  const total = stats && totalSectors > 0 ? totalSectors : Math.max(totalSectors, 1);
  const goodFrac = stats ? stats.good / total : pct / 100;
  const damagedFrac = stats ? (stats.failed + stats.skipped) / total : 0;
  const scannedFrac = stats
    ? (stats.good + stats.failed + stats.skipped) / total
    : pct / 100;

  const STROKE = 14;
  const GAP = 6;
  const r1 = C - STROKE / 2 - 6;
  const r2 = r1 - STROKE - GAP;
  const r3 = r2 - STROKE - GAP;
  const circ = (r: number) => 2 * Math.PI * r;

  // Snappy ring updates — power4.out, 0.4s. Detect 10% milestones + 100% completion.
  useEffect(() => {
    type RingSpec = {
      el: SVGCircleElement | null;
      group: SVGGElement | null;
      r: number;
      frac: number;
      prev: number;
      tint: string;
      isRecovered: boolean;
    };

    const specs: RingSpec[] = [
      {
        el: recoveredRef.current,
        group: recoveredGroupRef.current,
        r: r1,
        frac: Math.min(1, goodFrac),
        prev: lastGoodFracRef.current,
        tint: "#34C759",
        isRecovered: true,
      },
      {
        el: damagedRef.current,
        group: damagedGroupRef.current,
        r: r2,
        frac: Math.min(1, damagedFrac),
        prev: lastDamagedFracRef.current,
        tint: "#FF9500",
        isRecovered: false,
      },
      {
        el: scannedRef.current,
        group: scannedGroupRef.current,
        r: r3,
        frac: Math.min(1, scannedFrac),
        prev: lastScannedFracRef.current,
        tint: "#0A84FF",
        isRecovered: false,
      },
    ];

    const reduced = prefersReducedMotion();

    specs.forEach((spec) => {
      if (!spec.el) return;
      const c = circ(spec.r);
      const dash = c * spec.frac;
      if (reduced) {
        spec.el.style.strokeDasharray = `${dash} ${c - dash}`;
        return;
      }
      gsap.to(spec.el, {
        attr: { "stroke-dasharray": `${dash} ${c - dash}` },
        duration: 0.4,
        ease: "power4.out",
      });
    });

    if (reduced) {
      lastGoodFracRef.current = goodFrac;
      lastDamagedFracRef.current = damagedFrac;
      lastScannedFracRef.current = scannedFrac;
      return;
    }

    // Milestone detection — 10% crossings on Recovered ring only (per spec).
    const prevRecovered = lastGoodFracRef.current;
    const currRecovered = Math.min(1, goodFrac);
    if (currRecovered > prevRecovered) {
      const prevTier = Math.floor(prevRecovered * 10 + 1e-6);
      const currTier = Math.floor(currRecovered * 10 + 1e-6);
      for (let tier = prevTier + 1; tier <= currTier; tier++) {
        const pctValue = tier * 10;
        triggerMilestone(
          recoveredRef.current,
          r1,
          pctValue / 100,
          "#34C759",
          pctValue,
          labelLayerRef.current,
          hazeRef.current,
        );
      }
    }

    // 100% completion burst on each ring.
    specs.forEach((spec) => {
      if (spec.prev < 1 && spec.frac >= 1) {
        ringCompletionBurst(spec.group, spec.el, spec.r, spec.tint, burstHostRef.current);
      }
    });

    // Streak detection — Recovered grew, Damaged didn't.
    const recoveredGrew = goodFrac > lastGoodFracRef.current + 1e-6;
    const damagedGrew = damagedFrac > lastDamagedFracRef.current + 1e-6;
    if (recoveredGrew && !damagedGrew && goodFrac > 0.05) {
      if (!streakActiveRef.current) {
        streakActiveRef.current = true;
        if (streakRef.current) {
          gsap.fromTo(
            streakRef.current,
            { opacity: 0, y: 6, scale: 0.85 },
            { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(2)" },
          );
        }
      }
    } else if (damagedGrew) {
      if (streakActiveRef.current && streakRef.current) {
        streakActiveRef.current = false;
        gsap.to(streakRef.current, {
          opacity: 0,
          y: 6,
          scale: 0.85,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    }

    lastGoodFracRef.current = goodFrac;
    lastDamagedFracRef.current = damagedFrac;
    lastScannedFracRef.current = scannedFrac;
  }, [goodFrac, damagedFrac, scannedFrac, r1, r2, r3]);

  // Slot-machine digit roll for center %.
  useEffect(() => {
    const el = pctRef.current;
    if (!el) return;
    const delta = Math.abs(pct - lastPctRef.current);
    if (delta < 0.05) return;

    if (prefersReducedMotion()) {
      el.textContent = `${Math.round(pct)}`;
      lastPctRef.current = pct;
      return;
    }

    const useSlot = lastPctRef.current >= 0 && delta >= 2;
    if (useSlot) {
      slotRoll(el, Math.round(lastPctRef.current), Math.round(pct));
    } else {
      const start = parseFloat(el.textContent || "0");
      const obj = { v: Number.isFinite(start) ? start : 0 };
      gsap.to(obj, {
        v: pct,
        duration: 0.4,
        ease: "power4.out",
        onUpdate: () => {
          el.textContent = `${Math.round(obj.v)}`;
        },
      });
    }
    lastPctRef.current = pct;
  }, [pct]);

  // Live readouts in minutes
  const goodMin = stats
    ? sectorsToMinutes(stats.good)
    : Math.round((pct / 100) * sectorsToMinutes(totalSectors));
  const damagedMin = stats ? sectorsToMinutes(stats.failed + stats.skipped) : 0;
  const pendingMin = stats
    ? sectorsToMinutes(stats.unknown)
    : sectorsToMinutes(totalSectors) - goodMin;

  // Pulse legend values when they increase.
  useEffect(() => {
    if (prefersReducedMotion()) {
      lastGoodMinRef.current = goodMin;
      return;
    }
    if (goodMin > lastGoodMinRef.current && goodMinRef.current && lastGoodMinRef.current >= 0) {
      pulseValue(goodMinRef.current);
    }
    lastGoodMinRef.current = goodMin;
  }, [goodMin]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      lastDamagedMinRef.current = damagedMin;
      return;
    }
    if (
      damagedMin > lastDamagedMinRef.current &&
      damagedMinRef.current &&
      lastDamagedMinRef.current >= 0
    ) {
      pulseValue(damagedMinRef.current);
    }
    lastDamagedMinRef.current = damagedMin;
  }, [damagedMin]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      lastPendingMinRef.current = pendingMin;
      return;
    }
    if (
      pendingMin > lastPendingMinRef.current &&
      pendingMinRef.current &&
      lastPendingMinRef.current >= 0
    ) {
      pulseValue(pendingMinRef.current);
    }
    lastPendingMinRef.current = pendingMin;
  }, [pendingMin]);

  // gsap.context cleanup — required by spec, even though most tweens are
  // direct (registered tweens get reverted on unmount).
  useEffect(() => {
    if (!scopeRef.current) return;
    const ctx = gsap.context(() => {
      // Idle state — rings are static. isActive could later drive a subtle
      // "ready" pulse on the haze; intentionally minimal to keep at-rest stillness.
      if (!isActive) return;
    }, scopeRef);
    return () => ctx.revert();
  }, [isActive]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={scopeRef}
        className="relative"
        style={{ width: SIZE, height: SIZE }}
        aria-hidden
      >
        {/* Achievement haze — static tint, brightens on milestones */}
        <div
          ref={hazeRef}
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(52,199,89,0.10) 0%, rgba(52,199,89,0.04) 55%, transparent 80%)",
            opacity: 0.6,
          }}
        />

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

        {/* Burst host — sparkle particles get appended here */}
        <div
          ref={burstHostRef}
          className="pointer-events-none absolute inset-0"
        />

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative"
        >
          <defs>
            <linearGradient id="ara-recovered" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5AC8FA" />
              <stop offset="100%" stopColor="#34C759" />
            </linearGradient>
            <linearGradient id="ara-damaged" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFD60A" />
              <stop offset="100%" stopColor="#FF3B30" />
            </linearGradient>
            <linearGradient id="ara-scanned" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#5AC8FA" />
            </linearGradient>
          </defs>

          {/* Track rings */}
          <circle cx={C} cy={C} r={r1} fill="none" stroke="rgba(90,200,250,0.10)" strokeWidth={STROKE} />
          <circle cx={C} cy={C} r={r2} fill="none" stroke="rgba(255,149,0,0.10)" strokeWidth={STROKE} />
          <circle cx={C} cy={C} r={r3} fill="none" stroke="rgba(10,132,255,0.10)" strokeWidth={STROKE} />

          {/* Active rings (each wrapped in a group so we can scale-pop on completion) */}
          <g ref={recoveredGroupRef} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "fill-box" } as React.CSSProperties}>
            <circle
              ref={recoveredRef}
              cx={C}
              cy={C}
              r={r1}
              fill="none"
              stroke="url(#ara-recovered)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r1)}`}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ color: "#34C759" }}
            />
          </g>
          <g ref={damagedGroupRef} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "fill-box" } as React.CSSProperties}>
            <circle
              ref={damagedRef}
              cx={C}
              cy={C}
              r={r2}
              fill="none"
              stroke="url(#ara-damaged)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r2)}`}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ color: "#FF9500" }}
            />
          </g>
          <g ref={scannedGroupRef} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "fill-box" } as React.CSSProperties}>
            <circle
              ref={scannedRef}
              cx={C}
              cy={C}
              r={r3}
              fill="none"
              stroke="url(#ara-scanned)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r3)}`}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ color: "#0A84FF" }}
            />
          </g>
        </svg>

        {/* Floating milestone label layer */}
        <div
          ref={labelLayerRef}
          className="pointer-events-none absolute inset-0 overflow-visible"
        />

        {/* Center % readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-[10px] uppercase tracking-[0.20em] text-white/55">
            Recovered
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span
              ref={pctRef}
              className="font-display text-[40px] font-semibold tabular-nums leading-none text-white"
              style={{ letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}
            >
              0
            </span>
            <span className="text-[15px] font-semibold text-white/70">%</span>
          </div>
          {/* Streak indicator */}
          <div
            ref={streakRef}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFD60A]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#FFD60A]"
            style={{ opacity: 0 }}
          >
            <span aria-hidden>★</span>
            <span>streak</span>
          </div>
        </div>
      </div>

      {/* Live readout legend — pulses when values increase */}
      <div className="flex items-center gap-3 text-[11px]">
        <Legend
          colorClass="bg-[#34C759]"
          label="Saved"
          value={`${goodMin}m`}
          valueRef={goodMinRef}
        />
        <span className="text-ink-300">·</span>
        <Legend
          colorClass="bg-[#FF9500]"
          label="Damaged"
          value={`${damagedMin}m`}
          valueRef={damagedMinRef}
          dimmed={damagedMin === 0}
        />
        <span className="text-ink-300">·</span>
        <Legend
          colorClass="bg-[#0A84FF]"
          label="Pending"
          value={`${pendingMin}m`}
          valueRef={pendingMinRef}
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
  valueRef,
  dimmed = false,
}: {
  colorClass: string;
  label: string;
  value: string;
  valueRef?: React.RefObject<HTMLSpanElement>;
  dimmed?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${dimmed ? "opacity-50" : ""}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${colorClass}`} />
      <span className="text-ink-500">{label}</span>
      <span
        ref={valueRef}
        className="font-display tabular-nums font-semibold text-ink-900"
      >
        {value}
      </span>
    </div>
  );
}

/* -------------------- helpers -------------------- */

/**
 * Slot-machine roll: tween from `from` to `to`, briefly overshoot one digit
 * up to make it feel like a tumbler landing.
 */
function slotRoll(el: HTMLElement, from: number, to: number) {
  const obj = { v: from };
  gsap.killTweensOf(obj);
  gsap.to(obj, {
    v: to,
    duration: 0.5,
    ease: "power4.out",
    onUpdate: () => {
      el.textContent = `${Math.round(obj.v)}`;
    },
    onComplete: () => {
      el.textContent = `${Math.round(to)}`;
    },
  });
  // Tiny vertical "land" jolt on the digit.
  gsap.fromTo(
    el,
    { y: -4 },
    { y: 0, duration: 0.35, ease: "back.out(3)" },
  );
}

/**
 * 10% milestone: brief glow flash on the ring + floating "+10%" label fading
 * upward from the ring's leading edge + haze brighten.
 */
function triggerMilestone(
  ringEl: SVGCircleElement | null,
  radius: number,
  frac: number,
  color: string,
  pctValue: number,
  labelHost: HTMLElement | null,
  hazeEl: HTMLElement | null,
) {
  // Glow flash on the ring.
  if (ringEl) {
    gsap.fromTo(
      ringEl,
      { filter: `drop-shadow(0 0 0px ${color})` },
      {
        filter: `drop-shadow(0 0 14px ${color})`,
        duration: 0.18,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
    );
  }

  // Haze brighten + settle.
  if (hazeEl) {
    gsap.fromTo(
      hazeEl,
      { opacity: 1.0 },
      { opacity: 0.6, duration: 0.7, ease: "power2.out" },
    );
  }

  // Floating "+N%" label at the ring's leading edge.
  if (labelHost) {
    // Angle along the ring (start at top, sweep clockwise) for the leading edge.
    const angle = -Math.PI / 2 + frac * Math.PI * 2;
    const x = C + Math.cos(angle) * radius;
    const y = C + Math.sin(angle) * radius;

    const label = document.createElement("div");
    label.textContent = `+${pctValue === 100 ? "100" : "10"}%`;
    label.style.cssText = `
      position:absolute;
      left:${x}px;top:${y}px;
      transform:translate(-50%,-50%);
      padding:2px 8px;
      border-radius:9999px;
      background:${color};
      color:#04091A;
      font-size:11px;
      font-weight:700;
      letter-spacing:0.02em;
      box-shadow:0 4px 14px ${color}55, 0 0 0 1px rgba(255,255,255,0.25) inset;
      pointer-events:none;
      will-change:transform,opacity;
      white-space:nowrap;
      z-index:10;
    `;
    labelHost.appendChild(label);
    gsap.fromTo(
      label,
      { y: 0, opacity: 0, scale: 0.7 },
      {
        y: -28,
        opacity: 1,
        scale: 1,
        duration: 0.35,
        ease: "back.out(2.4)",
        onComplete: () => {
          gsap.to(label, {
            y: -56,
            opacity: 0,
            duration: 0.55,
            ease: "power2.in",
            onComplete: () => label.parentNode?.removeChild(label),
          });
        },
      },
    );
  }
}

/**
 * Ring completion celebration: sparkle burst at the ring's top (leading edge
 * after a full sweep returns to top) + scale pop on the ring group.
 */
function ringCompletionBurst(
  groupEl: SVGGElement | null,
  _ringEl: SVGCircleElement | null,
  _radius: number,
  _tint: string,
  burstHost: HTMLElement | null,
) {
  if (groupEl) {
    gsap.fromTo(
      groupEl,
      { scale: 1 },
      {
        scale: 1.05,
        duration: 0.22,
        ease: "back.out(2)",
        yoyo: true,
        repeat: 1,
        transformOrigin: `${C}px ${C}px`,
      },
    );
  }
  if (burstHost) {
    sparkleBurst(burstHost, 12);
  }
}

function pulseValue(el: HTMLElement) {
  gsap.fromTo(
    el,
    { scale: 1 },
    {
      scale: 1.18,
      duration: 0.18,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
      transformOrigin: "50% 50%",
    },
  );
}
