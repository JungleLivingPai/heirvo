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
const OUTER_RADIUS = 110;
const INNER_RADIUS = 80;
const SEGMENT_COUNT = 240;

const SECTOR_COLOR: Record<number, string> = {
  [SECTOR_STATE.Unknown]: "#1F2A3F",
  [SECTOR_STATE.Good]: "#34C759",
  [SECTOR_STATE.Failed]: "#FF3B30",
  [SECTOR_STATE.Skipped]: "#FF9500",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  const p1 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p3 = polarToCartesian(cx, cy, rInner, startAngle);
  const p4 = polarToCartesian(cx, cy, rInner, endAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

/**
 * CRTScanline — Retro VHS/CRT aesthetic.
 *
 * The disc carries a subtle CRT scanline overlay, slight chromatic aberration
 * (red/cyan ghost), and VHS tracking jitter on the unread region. As sectors
 * are recovered the scanlines stabilize and the noise clears. Plays directly
 * into the home-video memory metaphor — recovering the past from a damaged tape.
 */
export default function CRTScanline({ buckets, isActive, pct }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<SVGRectElement>(null);
  const jitterRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

  const segments = useMemo(() => {
    const arr: { d: string; color: string; idx: number }[] = [];
    const step = 360 / SEGMENT_COUNT;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const startA = i * step;
      const endA = startA + step;
      const d = arcPath(
        CENTER,
        CENTER,
        OUTER_RADIUS,
        INNER_RADIUS,
        startA,
        endA - 0.001,
      );
      let color = SECTOR_COLOR[SECTOR_STATE.Unknown];
      if (buckets.length > 0) {
        const bucketIdx = Math.floor((i / SEGMENT_COUNT) * buckets.length);
        const state = buckets[bucketIdx] ?? SECTOR_STATE.Unknown;
        color = SECTOR_COLOR[state] ?? SECTOR_COLOR[SECTOR_STATE.Unknown];
      }
      arr.push({ d, color, idx: i });
    }
    return arr;
  }, [buckets]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      // Scanline beam sweeps top-to-bottom continuously
      if (beamRef.current && isActive) {
        gsap.fromTo(
          beamRef.current,
          { attr: { y: -8 } },
          {
            attr: { y: SIZE + 8 },
            duration: 2.6,
            ease: "none",
            repeat: -1,
          },
        );
      }
      // VHS tracking jitter — small horizontal twitch
      if (jitterRef.current && isActive) {
        gsap.to(jitterRef.current, {
          x: "+=1.5",
          duration: 0.05,
          ease: "none",
          yoyo: true,
          repeat: -1,
          repeatRefresh: true,
          modifiers: {
            x: () => `${(Math.random() - 0.5) * 2.5}`,
          },
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
      ref={rootRef}
      className="relative flex items-center justify-center"
      style={{
        minHeight: SIZE + 16,
        background:
          "radial-gradient(closest-side, #0E1722, #060A12 80%)",
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      {/* CRT vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(closest-side, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="relative"
      >
        <defs>
          <pattern
            id="crtScanlines"
            patternUnits="userSpaceOnUse"
            width={SIZE}
            height={3}
          >
            <rect width={SIZE} height={3} fill="transparent" />
            <rect width={SIZE} height={1} fill="#000" opacity={0.35} />
          </pattern>
          <radialGradient id="crtBeamGrad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#5AC8FA" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0.0" />
          </radialGradient>
          <clipPath id="crtClip">
            <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS + 2} />
          </clipPath>
        </defs>

        {/* Disc base */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RADIUS + 2}
          fill="#0B1422"
          stroke="#1A2A40"
          strokeWidth={1}
        />

        {/* Chromatic-aberration ghost layers + segments */}
        <g ref={jitterRef}>
          <g opacity={0.5} style={{ mixBlendMode: "screen" }} transform="translate(1.5,0)">
            {segments.map((s) =>
              s.color === SECTOR_COLOR[SECTOR_STATE.Unknown] ? null : (
                <path key={`r-${s.idx}`} d={s.d} fill="#FF3B30" opacity={0.35} />
              ),
            )}
          </g>
          <g opacity={0.5} style={{ mixBlendMode: "screen" }} transform="translate(-1.5,0)">
            {segments.map((s) =>
              s.color === SECTOR_COLOR[SECTOR_STATE.Unknown] ? null : (
                <path key={`c-${s.idx}`} d={s.d} fill="#5AC8FA" opacity={0.35} />
              ),
            )}
          </g>

          {/* Main segments */}
          <g>
            {segments.map((s) => (
              <path key={s.idx} d={s.d} fill={s.color} />
            ))}
          </g>
        </g>

        {/* Scanline overlay (clipped to disc) */}
        <g clipPath="url(#crtClip)">
          <rect
            x={0}
            y={0}
            width={SIZE}
            height={SIZE}
            fill="url(#crtScanlines)"
            opacity={0.55}
            pointerEvents="none"
          />

          {/* Sweeping beam */}
          {isActive && (
            <rect
              ref={beamRef}
              x={0}
              y={-8}
              width={SIZE}
              height={28}
              fill="url(#crtBeamGrad)"
              opacity={0.7}
              pointerEvents="none"
            />
          )}
        </g>

        {/* Inner ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_RADIUS}
          fill="#070C16"
          stroke="#1A2A40"
          strokeWidth={0.75}
        />

        {/* Hub */}
        <circle cx={CENTER} cy={CENTER} r={6} fill="#5AC8FA" opacity={0.55} />
        <circle cx={CENTER} cy={CENTER} r={2} fill="#E0F4FF" />
      </svg>

      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center"
        style={{ width: INNER_RADIUS * 2, height: INNER_RADIUS * 2 }}
      >
        <div
          className="font-display tabular-nums"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.28em",
            color: "#5AC8FA",
            opacity: 0.85,
            textShadow: "0 0 6px rgba(90,200,250,0.6)",
          }}
        >
          REC
        </div>
        <div className="flex items-baseline gap-0.5 mt-0.5">
          <div
            ref={pctRef}
            className="font-display tabular-nums"
            style={{
              fontSize: 32,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              fontWeight: 600,
              color: "#E0F4FF",
              textShadow:
                "0.6px 0 0 rgba(255,59,48,0.55), -0.6px 0 0 rgba(90,200,250,0.55)",
            }}
          >
            0
          </div>
          <span
            className="font-display"
            style={{ fontSize: 13, fontWeight: 500, color: "#7FB8E8" }}
          >
            %
          </span>
        </div>
        <div
          className="mt-1"
          style={{
            fontSize: 7.5,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#5A7090",
            fontWeight: 600,
          }}
        >
          Tracking
        </div>
      </div>
    </div>
  );
}
