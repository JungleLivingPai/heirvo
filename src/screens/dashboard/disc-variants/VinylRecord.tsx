import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { SECTOR_STATE } from "@/lib/types";
import { countUp, prefersReducedMotion } from "@/utils/gsap-fx";

interface Props {
  buckets: number[];
  totalSectors: number;
  isActive: boolean;
  pct: number;
}

const SIZE = 240;
const CENTER = SIZE / 2;
const OUTER = 112;
const LABEL = 42;
const TRACK_COUNT = 28;

/**
 * VinylRecord — Premium archival vinyl LP.
 *
 * The disc renders like a black vinyl record with concentric grooves and a
 * prismatic glint that sweeps across the surface. As sectors are read, the
 * grooves at that radial position light up cyan. The center label rotates
 * slowly with the disc.
 */
export default function VinylRecord({ buckets, isActive, pct }: Props) {
  const discRef = useRef<SVGGElement>(null);
  const glintRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

  const { goodMask, failedMask } = useMemo(() => {
    // For each track ring, compute whether sectors at that radial slice
    // are mostly good/failed. We map track i to a contiguous slice of the
    // buckets (outer track = end of disc, inner = start).
    const good = new Array<boolean>(TRACK_COUNT).fill(false);
    const failed = new Array<boolean>(TRACK_COUNT).fill(false);
    if (buckets.length === 0) return { goodMask: good, failedMask: failed };
    for (let t = 0; t < TRACK_COUNT; t++) {
      const lo = Math.floor((t / TRACK_COUNT) * buckets.length);
      const hi = Math.floor(((t + 1) / TRACK_COUNT) * buckets.length);
      let g = 0, f = 0, n = 0;
      for (let i = lo; i < hi; i++) {
        const v = buckets[i];
        if (v === SECTOR_STATE.Good) g++;
        else if (v === SECTOR_STATE.Failed) f++;
        n++;
      }
      if (n === 0) continue;
      if (g / n > 0.5) good[t] = true;
      else if (f / n > 0.3) failed[t] = true;
    }
    return { goodMask: good, failedMask: failed };
  }, [buckets]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (discRef.current && isActive) {
        gsap.to(discRef.current, {
          rotation: 360,
          duration: 12,
          ease: "none",
          repeat: -1,
          transformOrigin: `${CENTER}px ${CENTER}px`,
        });
      }
      if (glintRef.current && isActive) {
        gsap.to(glintRef.current, {
          rotation: 360,
          duration: 6,
          ease: "none",
          repeat: -1,
          transformOrigin: `${CENTER}px ${CENTER}px`,
        });
      }
    });
    return () => ctx.revert();
  }, [isActive]);

  useEffect(() => {
    if (!pctRef.current) return;
    const rounded = Math.round(pct);
    if (rounded === lastPctRef.current) return;
    lastPctRef.current = rounded;
    countUp(pctRef.current, rounded, 1.0);
  }, [pct]);

  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: SIZE + 16 }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ filter: "drop-shadow(0 18px 36px rgba(10,23,41,0.35))" }}
      >
        <defs>
          <radialGradient id="vinylBody" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#1a1f2b" />
            <stop offset="60%" stopColor="#0a0d14" />
            <stop offset="100%" stopColor="#05070b" />
          </radialGradient>
          <radialGradient id="vinylLabel" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="60%" stopColor="#0066CC" />
            <stop offset="100%" stopColor="#003E80" />
          </radialGradient>
          <linearGradient id="prism" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF3B30" stopOpacity="0" />
            <stop offset="20%" stopColor="#FF9500" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#FFD60A" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#34C759" stopOpacity="0.45" />
            <stop offset="80%" stopColor="#5AC8FA" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Disc body */}
        <g ref={discRef}>
          <circle cx={CENTER} cy={CENTER} r={OUTER} fill="url(#vinylBody)" />

          {/* Concentric grooves */}
          {Array.from({ length: TRACK_COUNT }, (_, i) => {
            const r = LABEL + 4 + ((OUTER - LABEL - 6) * i) / TRACK_COUNT;
            const isGood = goodMask[i];
            const isFailed = failedMask[i];
            const stroke = isGood
              ? "#5AC8FA"
              : isFailed
                ? "#FF3B30"
                : "#000000";
            const opacity = isGood ? 0.85 : isFailed ? 0.7 : 0.55;
            return (
              <circle
                key={i}
                cx={CENTER}
                cy={CENTER}
                r={r}
                fill="none"
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth={isGood || isFailed ? 1.1 : 0.6}
                style={
                  isGood
                    ? { filter: "drop-shadow(0 0 2px rgba(90,200,250,0.7))" }
                    : undefined
                }
              />
            );
          })}

          {/* Prismatic glint sweep */}
          <g ref={glintRef} style={{ mixBlendMode: "screen", opacity: 0.55 }}>
            <ellipse
              cx={CENTER}
              cy={CENTER}
              rx={OUTER - 4}
              ry={18}
              fill="url(#prism)"
            />
          </g>

          {/* Center label */}
          <circle cx={CENTER} cy={CENTER} r={LABEL} fill="url(#vinylLabel)" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={LABEL}
            fill="none"
            stroke="#5AC8FA"
            strokeOpacity={0.4}
            strokeWidth={0.75}
          />
          {/* Spindle hole */}
          <circle cx={CENTER} cy={CENTER} r={4} fill="#05070b" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={4}
            fill="none"
            stroke="#0A84FF"
            strokeOpacity={0.6}
            strokeWidth={0.5}
          />
        </g>

        {/* Outer rim highlight */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER}
          fill="none"
          stroke="#5AC8FA"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      </svg>

      {/* Center % label (counter-rotating, on top of label) */}
      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center"
        style={{ width: LABEL * 2, height: LABEL * 2 }}
      >
        <div className="flex items-baseline gap-0.5">
          <div
            ref={pctRef}
            className="font-display tabular-nums"
            style={{
              fontSize: 26,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              fontWeight: 600,
              color: "#FFFFFF",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            0
          </div>
          <span
            className="font-display"
            style={{ fontSize: 12, fontWeight: 500, color: "#BFD9FF" }}
          >
            %
          </span>
        </div>
        <div
          className="mt-0.5"
          style={{
            fontSize: 7.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#5AC8FA",
            fontWeight: 600,
          }}
        >
          Recovered
        </div>
      </div>
    </div>
  );
}
