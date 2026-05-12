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
const OUTER = 110;
const INNER = 32;
const FACET_COUNT = 24;

/**
 * CrystalLens — Crystalline glass lens with refraction.
 *
 * The disc is a faceted crystal. Recovered sectors brighten the corresponding
 * facet wedge with cyan light; failed sectors leave dark veins. A soft caustic
 * light pattern slowly drifts across the surface, giving real 3D depth via
 * SVG filters. Premium, jewel-like.
 */
export default function CrystalLens({ buckets, isActive, pct }: Props) {
  const causticRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

  const facets = useMemo(() => {
    const arr: {
      d: string;
      good: number;
      failed: number;
      total: number;
      idx: number;
    }[] = [];
    for (let i = 0; i < FACET_COUNT; i++) {
      const a0 = (i / FACET_COUNT) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / FACET_COUNT) * Math.PI * 2 - Math.PI / 2;
      const x0o = CENTER + OUTER * Math.cos(a0);
      const y0o = CENTER + OUTER * Math.sin(a0);
      const x1o = CENTER + OUTER * Math.cos(a1);
      const y1o = CENTER + OUTER * Math.sin(a1);
      const x0i = CENTER + INNER * Math.cos(a0);
      const y0i = CENTER + INNER * Math.sin(a0);
      const x1i = CENTER + INNER * Math.cos(a1);
      const y1i = CENTER + INNER * Math.sin(a1);
      const d = `M ${x0o} ${y0o} L ${x1o} ${y1o} L ${x1i} ${y1i} L ${x0i} ${y0i} Z`;

      let good = 0, failed = 0, total = 0;
      if (buckets.length > 0) {
        const lo = Math.floor((i / FACET_COUNT) * buckets.length);
        const hi = Math.floor(((i + 1) / FACET_COUNT) * buckets.length);
        for (let k = lo; k < hi; k++) {
          const v = buckets[k];
          if (v === SECTOR_STATE.Good) good++;
          else if (v === SECTOR_STATE.Failed) failed++;
          total++;
        }
      }
      arr.push({ d, good, failed, total, idx: i });
    }
    return arr;
  }, [buckets]);

  // Caustic light drift
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (causticRef.current && isActive) {
        gsap.to(causticRef.current, {
          rotation: 360,
          duration: 24,
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
    <div
      className="relative flex items-center justify-center"
      style={{ minHeight: SIZE + 16 }}
    >
      {/* Glow halo */}
      {isActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            width: SIZE * 1.15,
            height: SIZE * 1.15,
            background:
              "radial-gradient(closest-side, rgba(90,200,250,0.32), rgba(10,132,255,0.12) 50%, transparent 75%)",
            filter: "blur(14px)",
          }}
        />
      )}

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ filter: "drop-shadow(0 14px 32px rgba(10,23,41,0.18))" }}
      >
        <defs>
          <radialGradient id="cr-base" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#F4FBFF" />
            <stop offset="60%" stopColor="#D7EAFA" />
            <stop offset="100%" stopColor="#A8C7E0" />
          </radialGradient>
          <radialGradient id="cr-good" cx="0.5" cy="0.5" r="0.7">
            <stop offset="0%" stopColor="#A8E4F8" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#5AC8FA" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="cr-fail" cx="0.5" cy="0.5" r="0.7">
            <stop offset="0%" stopColor="#3A1A2E" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#7A2030" stopOpacity="0.55" />
          </radialGradient>
          <linearGradient id="cr-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#5AC8FA" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id="cr-hub" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E8F4FE" />
            <stop offset="100%" stopColor="#A8C7E0" />
          </radialGradient>
          <filter id="cr-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <radialGradient id="cr-caustic" cx="0.3" cy="0.3" r="0.5">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Crystal base body */}
        <circle cx={CENTER} cy={CENTER} r={OUTER} fill="url(#cr-base)" />

        {/* Facets */}
        <g filter="url(#cr-soft)">
          {facets.map((f) => {
            const goodFrac = f.total > 0 ? f.good / f.total : 0;
            const failFrac = f.total > 0 ? f.failed / f.total : 0;
            let fill = "url(#cr-base)";
            let opacity = 1;
            if (goodFrac > 0.5) {
              fill = "url(#cr-good)";
              opacity = 0.7 + goodFrac * 0.3;
            } else if (failFrac > 0.3) {
              fill = "url(#cr-fail)";
              opacity = 0.6 + failFrac * 0.4;
            }
            return (
              <path
                key={f.idx}
                d={f.d}
                fill={fill}
                fillOpacity={opacity}
                stroke="#FFFFFF"
                strokeOpacity={0.35}
                strokeWidth={0.4}
              />
            );
          })}
        </g>

        {/* Caustic light overlay */}
        <g
          ref={causticRef}
          style={{
            mixBlendMode: "screen",
            transformOrigin: `${CENTER}px ${CENTER}px`,
          }}
        >
          <ellipse
            cx={CENTER - 30}
            cy={CENTER - 28}
            rx={48}
            ry={20}
            fill="url(#cr-caustic)"
            opacity={0.7}
          />
          <ellipse
            cx={CENTER + 36}
            cy={CENTER + 24}
            rx={36}
            ry={14}
            fill="url(#cr-caustic)"
            opacity={0.45}
          />
        </g>

        {/* Outer rim */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER}
          fill="none"
          stroke="url(#cr-edge)"
          strokeWidth={1.5}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER - 3}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.3}
          strokeWidth={0.6}
        />

        {/* Inner cavity for label */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER}
          fill="url(#cr-hub)"
          stroke="#5AC8FA"
          strokeOpacity={0.45}
          strokeWidth={0.75}
          style={{ filter: "drop-shadow(0 2px 6px rgba(10,23,41,0.18))" }}
        />
      </svg>

      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center"
        style={{ width: INNER * 2, height: INNER * 2 }}
      >
        <div className="flex items-baseline gap-0.5">
          <div
            ref={pctRef}
            className="font-display tabular-nums"
            style={{
              fontSize: 24,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              fontWeight: 600,
              background: "linear-gradient(180deg, #0A84FF 0%, #0066CC 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            0
          </div>
          <span
            className="font-display"
            style={{ fontSize: 11, fontWeight: 500, color: "#5C6B82" }}
          >
            %
          </span>
        </div>
        <div
          className="mt-0.5"
          style={{
            fontSize: 6.5,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#9AA6B8",
            fontWeight: 600,
          }}
        >
          Clarity
        </div>
      </div>
    </div>
  );
}
