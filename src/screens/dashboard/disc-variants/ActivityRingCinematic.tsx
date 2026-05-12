import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "@/utils/gsap-fx";
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
const PARTICLE_COUNT = 12;
const TICK_COUNT = 60;

/**
 * ActivityRingCinematic — "Apple keynote backdrop" interpretation of the
 * three-ring recovery visualization.
 *
 * Layered ambience around the same telemetry the baseline ActivityRing uses:
 *   - Slow Ken Burns drift on the whole disc group (~32s cycle)
 *   - 12 floating cyan particles drifting upward inside the navy backdrop
 *   - Disc-health tint: navy shifts subtly warm when damagedFrac >= 5%
 *   - 60 hairline tick marks around the outer track; ticks under the
 *     "recovered" arc brighten (premium-watch detail)
 *   - Soft inner light bloom whose intensity scales with pct/100
 *   - 1.0s power3.out ring tweens (slower, more considered)
 *   - Pulse halos on the legend dots, color-matched to ring gradients
 *
 * Contemplative — no milestone bursts, no gamification. Just layered light.
 */
export default function ActivityRingCinematic({
  totalSectors,
  isActive,
  pct,
  stats,
}: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const discGroupRef = useRef<SVGGElement>(null);
  const recoveredRef = useRef<SVGCircleElement>(null);
  const damagedRef = useRef<SVGCircleElement>(null);
  const scannedRef = useRef<SVGCircleElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<SVGCircleElement>(null);
  const ticksGroupRef = useRef<SVGGElement>(null);
  const lastPctRef = useRef<number>(-1);

  const total = stats && totalSectors > 0 ? totalSectors : Math.max(totalSectors, 1);
  const goodFrac = stats ? stats.good / total : pct / 100;
  const damagedFrac = stats
    ? (stats.failed + stats.skipped) / total
    : 0;
  const scannedFrac = stats
    ? (stats.good + stats.failed + stats.skipped) / total
    : pct / 100;

  const STROKE = 14;
  const GAP = 6;
  const r1 = C - STROKE / 2 - 6; // Recovered (outer)
  const r2 = r1 - STROKE - GAP; // Damaged (middle)
  const r3 = r2 - STROKE - GAP; // Scanned (inner)
  const circ = (r: number) => 2 * Math.PI * r;

  // Stable particle seeds — don't reshuffle every render
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        // Deterministic-ish pseudo-random per index
        const rand = (n: number) => {
          const x = Math.sin(i * 9301 + n * 49297) * 233280;
          return x - Math.floor(x);
        };
        const angle = rand(1) * Math.PI * 2;
        const radius = 30 + rand(2) * 70;
        const startX = C + Math.cos(angle) * radius;
        const startY = C + Math.sin(angle) * radius;
        return {
          id: i,
          x: startX,
          y: startY,
          size: 1.2 + rand(3) * 1.4,
          drift: -40 - rand(4) * 60, // upward translation in px
          spread: (rand(5) - 0.5) * 30, // horizontal drift
          duration: 6 + rand(6) * 6,
          delay: rand(7) * 8,
        };
      }),
    [],
  );

  // Tick mark angles (60 of them, evenly spaced)
  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => {
        const angleDeg = (i / TICK_COUNT) * 360 - 90; // start at 12 o'clock
        return { i, angleDeg, frac: i / TICK_COUNT };
      }),
    [],
  );

  // Ring tweens — 1.0s power3.out
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
        duration: 1.0,
        ease: "power3.out",
      });
    });
  }, [goodFrac, damagedFrac, scannedFrac, r1, r2, r3]);

  // Tick brightening — ticks falling under the recovered arc light up
  useEffect(() => {
    const grp = ticksGroupRef.current;
    if (!grp) return;
    const lines = grp.querySelectorAll<SVGLineElement>("line");
    lines.forEach((line, i) => {
      const frac = i / TICK_COUNT;
      const isLit = frac < goodFrac;
      const targetOpacity = isLit ? 0.55 : 0.10;
      if (prefersReducedMotion()) {
        line.style.opacity = String(targetOpacity);
        return;
      }
      gsap.to(line, {
        opacity: targetOpacity,
        duration: 1.0,
        ease: "power2.out",
      });
    });
  }, [goodFrac]);

  // Inner bloom intensity — scales with pct
  useEffect(() => {
    const el = bloomRef.current;
    if (!el) return;
    const intensity = Math.min(1, Math.max(0, pct / 100));
    const targetOpacity = 0.12 + intensity * 0.42;
    if (prefersReducedMotion()) {
      el.style.opacity = String(targetOpacity);
      return;
    }
    gsap.to(el, {
      opacity: targetOpacity,
      duration: 1.2,
      ease: "power2.out",
    });
  }, [pct]);

  // Center % count-up
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
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(obj.v)}`;
      },
    });
  }, [pct]);

  // Disc-health color shift — warm tint when damage >= 5%
  useEffect(() => {
    const el = tintRef.current;
    if (!el) return;
    const targetOpacity = damagedFrac >= 0.05 ? 1 : 0;
    if (prefersReducedMotion()) {
      el.style.opacity = String(targetOpacity);
      return;
    }
    gsap.to(el, {
      opacity: targetOpacity,
      duration: 3.0,
      ease: "sine.inOut",
    });
  }, [damagedFrac]);

  // Ken Burns drift + particles + active glow + legend halos
  useEffect(() => {
    if (!scopeRef.current) return;
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      // Ken Burns — slow pan + scale on the disc group
      if (discGroupRef.current) {
        gsap.to(discGroupRef.current, {
          x: 4,
          y: -3,
          scale: 1.02,
          transformOrigin: "50% 50%",
          duration: 16,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }

      // Floating particles
      const particleEls = scopeRef.current?.querySelectorAll<SVGGElement>(
        "[data-particle]",
      );
      particleEls?.forEach((el, i) => {
        const p = particles[i];
        gsap.set(el, { opacity: 0 });
        gsap
          .timeline({ repeat: -1, delay: p.delay })
          .to(el, { opacity: 1, duration: p.duration * 0.25, ease: "sine.out" })
          .to(
            el,
            {
              x: p.spread,
              y: p.drift,
              duration: p.duration,
              ease: "sine.inOut",
            },
            0,
          )
          .to(
            el,
            {
              opacity: 0,
              duration: p.duration * 0.35,
              ease: "sine.in",
            },
            p.duration * 0.65,
          );
      });

      // Active rings: subtle drop-shadow breathing
      if (isActive) {
        gsap.to(
          [recoveredRef.current, damagedRef.current, scannedRef.current],
          {
            filter: "drop-shadow(0 0 6px currentColor)",
            duration: 2.4,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            stagger: 0.3,
          },
        );
      }

      // Legend halo pulses
      const halos = scopeRef.current?.parentElement?.querySelectorAll<HTMLElement>(
        "[data-legend-halo]",
      );
      halos?.forEach((el, i) => {
        gsap.to(el, {
          scale: 1.8,
          opacity: 0,
          duration: 2.2,
          ease: "sine.out",
          repeat: -1,
          delay: i * 0.5,
        });
      });
    }, scopeRef);

    return () => ctx.revert();
  }, [isActive, particles]);

  const goodMin = stats
    ? sectorsToMinutes(stats.good)
    : Math.round((pct / 100) * sectorsToMinutes(totalSectors));
  const damagedMin = stats ? sectorsToMinutes(stats.failed + stats.skipped) : 0;
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
        {/* Cool navy backdrop */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, #1A2540 0%, #0A1729 70%, #04091A 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 36px -12px rgba(10,23,41,0.55)",
          }}
        />
        {/* Warm-tint overlay (damage health) */}
        <div
          ref={tintRef}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(50,28,40,0.55) 0%, rgba(26,21,37,0.35) 60%, transparent 100%)",
            opacity: 0,
            mixBlendMode: "screen",
          }}
        />

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="arc-recovered" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5AC8FA" />
              <stop offset="100%" stopColor="#34C759" />
            </linearGradient>
            <linearGradient id="arc-damaged" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFD60A" />
              <stop offset="100%" stopColor="#FF3B30" />
            </linearGradient>
            <linearGradient id="arc-scanned" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#5AC8FA" />
            </linearGradient>
            {/* Inner bloom — soft white-cyan light */}
            <radialGradient id="arc-bloom" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#A8E1FF" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#5AC8FA" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
            {/* Particle sparkle */}
            <radialGradient id="arc-particle" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#A8E1FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
            {/* Clip particles to the disc */}
            <clipPath id="arc-disc-clip">
              <circle cx={C} cy={C} r={C - 2} />
            </clipPath>
          </defs>

          {/* Disc group — Ken Burns target */}
          <g ref={discGroupRef}>
            {/* Particles (behind rings, clipped to disc) */}
            <g clipPath="url(#arc-disc-clip)">
              {particles.map((p) => (
                <g key={p.id} data-particle>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.size}
                    fill="url(#arc-particle)"
                  />
                </g>
              ))}
            </g>

            {/* Inner bloom — center light that grows with pct */}
            <circle
              ref={bloomRef}
              cx={C}
              cy={C}
              r={r3 - STROKE - 4}
              fill="url(#arc-bloom)"
              style={{ opacity: 0.12 }}
            />

            {/* Hairline tick marks around the outer track */}
            <g ref={ticksGroupRef}>
              {ticks.map((t) => {
                const tickInner = r1 + STROKE / 2 + 2;
                const tickOuter = tickInner + 4;
                const rad = (t.angleDeg * Math.PI) / 180;
                const x1 = C + Math.cos(rad) * tickInner;
                const y1 = C + Math.sin(rad) * tickInner;
                const x2 = C + Math.cos(rad) * tickOuter;
                const y2 = C + Math.sin(rad) * tickOuter;
                return (
                  <line
                    key={t.i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#A8E1FF"
                    strokeWidth={1}
                    strokeLinecap="round"
                    style={{ opacity: 0.10 }}
                  />
                );
              })}
            </g>

            {/* Track rings */}
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
              stroke="url(#arc-recovered)"
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
              stroke="url(#arc-damaged)"
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
              stroke="url(#arc-scanned)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`0 ${circ(r3)}`}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ color: "#0A84FF" }}
            />
          </g>
        </svg>

        {/* Center % readout — extra-light, tighter letter-spacing */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="font-display text-[10px] uppercase text-white/55"
            style={{ letterSpacing: "0.24em" }}
          >
            Recovered
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span
              ref={pctRef}
              className="font-display tabular-nums leading-none text-white"
              style={{
                fontSize: 42,
                fontWeight: 200,
                letterSpacing: "-0.035em",
                fontVariationSettings: '"wght" 240',
              }}
            >
              0
            </span>
            <span
              className="text-white/65"
              style={{ fontSize: 15, fontWeight: 300, letterSpacing: "-0.02em" }}
            >
              %
            </span>
          </div>
        </div>
      </div>

      {/* Live legend with pulse halos */}
      <div className="flex items-center gap-3 text-[11px]">
        <CinematicLegend
          color="#34C759"
          label="Saved"
          value={`${goodMin}m`}
        />
        <span className="text-ink-300">·</span>
        <CinematicLegend
          color="#FF9500"
          label="Damaged"
          value={`${damagedMin}m`}
          dimmed={damagedMin === 0}
        />
        <span className="text-ink-300">·</span>
        <CinematicLegend
          color="#0A84FF"
          label="Pending"
          value={`${pendingMin}m`}
          dimmed={pendingMin === 0}
        />
      </div>
    </div>
  );
}

function CinematicLegend({
  color,
  label,
  value,
  dimmed = false,
}: {
  color: string;
  label: string;
  value: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${dimmed ? "opacity-50" : ""}`}
    >
      <span className="relative inline-flex h-2 w-2 items-center justify-center">
        <span
          data-legend-halo
          className="absolute inset-0 rounded-full"
          style={{ background: color, opacity: 0.55 }}
        />
        <span
          className="relative inline-block h-2 w-2 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 6px ${color}55`,
          }}
        />
      </span>
      <span className="text-ink-500">{label}</span>
      <span className="font-display tabular-nums font-semibold text-ink-900">
        {value}
      </span>
    </div>
  );
}
