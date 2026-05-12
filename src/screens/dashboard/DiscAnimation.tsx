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

const SEGMENT_COUNT = 360;
const SIZE = 280;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 130;
const INNER_RADIUS = 96;
const ARM_INNER = 22;
const ARM_OUTER = INNER_RADIUS - 4;

const SECTOR_COLOR: Record<number, string> = {
  [SECTOR_STATE.Unknown]: "#E1E6EE",
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

export function DiscAnimation({ buckets, isActive, pct }: Props) {
  const armRef = useRef<SVGGElement>(null);
  const discRef = useRef<SVGSVGElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<SVGCircleElement>(null);
  const lastBucketsRef = useRef<number[]>([]);
  const lastAngleRef = useRef<number>(0);
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

  // Detect most recently changed bucket and rotate arm to it
  useEffect(() => {
    if (!armRef.current) return;
    if (buckets.length === 0) return;
    const prev = lastBucketsRef.current;
    let changedIdx = -1;
    if (prev.length === buckets.length) {
      for (let i = 0; i < buckets.length; i++) {
        if (prev[i] !== buckets[i]) {
          changedIdx = i;
        }
      }
    }
    lastBucketsRef.current = buckets.slice();

    let targetAngle = lastAngleRef.current;
    if (changedIdx >= 0) {
      targetAngle = (changedIdx / buckets.length) * 360;
    } else if (isActive) {
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (buckets[i] !== SECTOR_STATE.Unknown) {
          targetAngle = (i / buckets.length) * 360;
          break;
        }
      }
    }

    if (prefersReducedMotion()) {
      gsap.set(armRef.current, { rotation: targetAngle, transformOrigin: "50% 50%" });
    } else {
      gsap.to(armRef.current, {
        rotation: targetAngle,
        duration: 0.8,
        ease: "power2.out",
        transformOrigin: "50% 50%",
      });
    }
    lastAngleRef.current = targetAngle;
  }, [buckets, isActive]);

  // Idle breath + shimmer ring rotation
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (discRef.current) {
        if (isActive) {
          gsap.to(discRef.current, { scale: 1, duration: 0.4, transformOrigin: "50% 50%" });
        } else {
          gsap.to(discRef.current, {
            scale: 1.012,
            duration: 3,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            transformOrigin: "50% 50%",
          });
        }
      }
      // Slow shimmer rotation on the outer ring (CD catching light)
      if (shimmerRef.current && isActive) {
        gsap.to(shimmerRef.current, {
          rotation: 360,
          duration: 8,
          ease: "none",
          repeat: -1,
          transformOrigin: `${CENTER}px ${CENTER}px`,
        });
      }
    });
    return () => ctx.revert();
  }, [isActive]);

  // Animate pct
  useEffect(() => {
    if (!pctRef.current) return;
    const rounded = Math.round(pct);
    if (rounded === lastPctRef.current) return;
    lastPctRef.current = rounded;
    countUp(pctRef.current, rounded, 1.0);
  }, [pct]);

  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: SIZE + 40 }}>
      {/* Soft cyan radial glow when active */}
      {isActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            width: SIZE * 1.2,
            height: SIZE * 1.2,
            background:
              "radial-gradient(closest-side, rgba(10,132,255,0.22), rgba(90,200,250,0.10) 50%, transparent 75%)",
            filter: "blur(8px)",
          }}
        />
      )}

      <svg
        ref={discRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="relative"
        style={{ filter: "drop-shadow(0 14px 32px rgba(10,23,41,0.14))" }}
      >
        <defs>
          <linearGradient id="armGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#5AC8FA" />
          </linearGradient>
          {/* Conic-style sweep for the shimmer ring */}
          <linearGradient id="shimmerGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0A84FF" stopOpacity="0" />
            <stop offset="35%" stopColor="#0A84FF" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#5AC8FA" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#0A84FF" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hubGloss" cx="0.5" cy="0.32" r="0.75">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#F8FAFC" stopOpacity="1" />
            <stop offset="100%" stopColor="#E8EEF7" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="hubStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0.25" />
          </linearGradient>
          <filter id="armGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* DVD-surface radial line texture */}
          <pattern
            id="discTexture"
            patternUnits="userSpaceOnUse"
            width={SIZE}
            height={SIZE}
          >
            {Array.from({ length: 64 }, (_, i) => {
              const r = INNER_RADIUS + ((OUTER_RADIUS - INNER_RADIUS) * i) / 64;
              return (
                <circle
                  key={i}
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke="#0A1729"
                  strokeOpacity={i % 2 === 0 ? 0.05 : 0.02}
                  strokeWidth={0.5}
                />
              );
            })}
          </pattern>
          {/* Specular highlight across the disc */}
          <radialGradient id="specular" cx="0.32" cy="0.28" r="0.4">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <clipPath id="ringClip">
            <path
              d={`M ${CENTER} ${CENTER - OUTER_RADIUS} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - OUTER_RADIUS}
                  L ${CENTER - 0.01} ${CENTER - INNER_RADIUS}
                  A ${INNER_RADIUS} ${INNER_RADIUS} 0 1 0 ${CENTER} ${CENTER - INNER_RADIUS} Z`}
            />
          </clipPath>
        </defs>

        {/* Outer subtle ring (background) */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RADIUS + 4}
          fill="none"
          stroke="#E1E6EE"
          strokeWidth={1}
        />

        {/* Sector segments */}
        <g>
          {segments.map((s) => (
            <path key={s.idx} d={s.d} fill={s.color} />
          ))}
        </g>

        {/* DVD reflective texture overlay (radial line stripes) */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RADIUS}
          fill="url(#discTexture)"
          pointerEvents="none"
        />

        {/* Specular highlight — gives the disc a tilted-into-light feel */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RADIUS}
          fill="url(#specular)"
          pointerEvents="none"
        />

        {/* Shimmer ring — slow rotating gradient sweep on outer perimeter */}
        {isActive && (
          <g ref={shimmerRef as unknown as React.RefObject<SVGGElement>}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={OUTER_RADIUS + 1}
              fill="none"
              stroke="url(#shimmerGradient)"
              strokeWidth={2}
              opacity={0.9}
            />
          </g>
        )}

        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_RADIUS - 1}
          fill="none"
          stroke="#E1E6EE"
          strokeWidth={1}
        />

        {/* Read arm */}
        <g ref={armRef} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
          <g filter={isActive ? "url(#armGlow)" : undefined}>
            <line
              x1={CENTER}
              y1={CENTER - ARM_INNER}
              x2={CENTER}
              y2={CENTER - ARM_OUTER}
              stroke="url(#armGradient)"
              strokeWidth={3.5}
              strokeLinecap="round"
            />
            <circle
              cx={CENTER}
              cy={CENTER - ARM_OUTER}
              r={4}
              fill="url(#armGradient)"
            />
          </g>
        </g>

        {/* Center hub — feels like a hub, not a label */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={ARM_INNER + 4}
          fill="url(#hubGloss)"
          stroke="url(#hubStroke)"
          strokeWidth={1}
          style={{ filter: "drop-shadow(0 2px 6px rgba(10,23,41,0.10))" }}
        />
        {/* Hub inner ring (mechanical look) */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={ARM_INNER - 4}
          fill="none"
          stroke="#C9D1DD"
          strokeWidth={0.75}
          strokeDasharray="2 3"
          opacity={0.7}
        />
        {/* Hub center spindle dot */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={3}
          fill="#0A84FF"
          opacity={0.85}
        />
      </svg>

      {/* Center % label — typeset, not Tailwind'd */}
      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center"
        style={{ width: INNER_RADIUS * 2, height: INNER_RADIUS * 2 }}
      >
        <div className="flex items-baseline gap-0.5">
          <div
            ref={pctRef}
            className="font-display tabular-nums"
            style={{
              fontSize: 46,
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
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "#5C6B82",
              letterSpacing: "-0.02em",
            }}
          >
            %
          </span>
        </div>
        <div
          className="mt-2"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#9AA6B8",
            fontWeight: 500,
          }}
        >
          Recovered
        </div>
      </div>
    </div>
  );
}
