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
const RING_COUNT = 7;
const INNER_R = 38;
const OUTER_R = 110;

/**
 * Constellation — Abstract sector star map.
 *
 * Each bucket is a tiny dot arranged in concentric rings. Good = cyan glow,
 * failed = soft red, unknown = dim white. Pulse animation propagates outward
 * as new sectors are read. Looks like a star chart being plotted.
 */
export default function Constellation({ buckets, isActive, pct }: Props) {
  const dotsRef = useRef<SVGGElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

  // Distribute buckets across rings: outer rings have more dots.
  // We compute (ring, angle) for each bucket index.
  const dots = useMemo(() => {
    if (buckets.length === 0) return [];
    // Compute capacity per ring proportional to circumference.
    const radii: number[] = [];
    for (let i = 0; i < RING_COUNT; i++) {
      radii.push(INNER_R + ((OUTER_R - INNER_R) * i) / (RING_COUNT - 1));
    }
    const totalCirc = radii.reduce((a, b) => a + b, 0);
    const perRing: number[] = radii.map((r) =>
      Math.max(8, Math.round((buckets.length * r) / totalCirc)),
    );
    // Adjust last ring to consume any remainder so total >= buckets.length
    let sum = perRing.reduce((a, b) => a + b, 0);
    while (sum < buckets.length) {
      perRing[RING_COUNT - 1]++;
      sum++;
    }

    const out: { x: number; y: number; state: number; idx: number; r: number }[] = [];
    let bIdx = 0;
    for (let ring = 0; ring < RING_COUNT; ring++) {
      const count = perRing[ring];
      const r = radii[ring];
      for (let k = 0; k < count && bIdx < buckets.length; k++) {
        const a = (k / count) * Math.PI * 2 - Math.PI / 2;
        // Slight stagger per ring for organic feel
        const aOff = (ring % 2 === 0 ? 0 : Math.PI / count);
        const x = CENTER + r * Math.cos(a + aOff);
        const y = CENTER + r * Math.sin(a + aOff);
        out.push({ x, y, state: buckets[bIdx], idx: bIdx, r });
        bIdx++;
      }
    }
    return out;
  }, [buckets]);

  // Idle pulse ring + dot twinkle
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (pulseRef.current && isActive) {
        gsap.fromTo(
          pulseRef.current,
          { attr: { r: INNER_R }, opacity: 0.55 },
          {
            attr: { r: OUTER_R + 12 },
            opacity: 0,
            duration: 2.4,
            ease: "power2.out",
            repeat: -1,
          },
        );
      }
      if (dotsRef.current) {
        const goodDots = dotsRef.current.querySelectorAll<SVGCircleElement>(
          "[data-state='good']",
        );
        if (goodDots.length > 0 && isActive) {
          gsap.to(goodDots, {
            opacity: 0.6,
            duration: 1.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: { from: "random", amount: 1.2 },
          });
        }
      }
    });
    return () => ctx.revert();
  }, [isActive, dots]);

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
      style={{
        minHeight: SIZE + 16,
        background:
          "radial-gradient(closest-side, rgba(10,23,41,0.92), rgba(5,12,24,0.98))",
        borderRadius: 18,
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="c-good" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="1" />
            <stop offset="60%" stopColor="#0A84FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="c-fail" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FF6B6B" stopOpacity="1" />
            <stop offset="100%" stopColor="#FF3B30" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Faint guide rings */}
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <circle
            key={i}
            cx={CENTER}
            cy={CENTER}
            r={INNER_R + ((OUTER_R - INNER_R) * i) / (RING_COUNT - 1)}
            fill="none"
            stroke="#1B2638"
            strokeOpacity={0.7}
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        ))}

        {/* Pulse ring */}
        {isActive && (
          <circle
            ref={pulseRef}
            cx={CENTER}
            cy={CENTER}
            r={INNER_R}
            fill="none"
            stroke="#5AC8FA"
            strokeWidth={1.2}
            opacity={0}
          />
        )}

        {/* Dots */}
        <g ref={dotsRef}>
          {dots.map((d) => {
            const isGood = d.state === SECTOR_STATE.Good;
            const isFailed = d.state === SECTOR_STATE.Failed;
            const isSkipped = d.state === SECTOR_STATE.Skipped;
            if (isGood) {
              return (
                <g key={d.idx} data-state="good">
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={4}
                    fill="url(#c-good)"
                    opacity={0.55}
                  />
                  <circle cx={d.x} cy={d.y} r={1.4} fill="#E0F4FF" />
                </g>
              );
            }
            if (isFailed) {
              return (
                <g key={d.idx} data-state="fail">
                  <circle cx={d.x} cy={d.y} r={3} fill="url(#c-fail)" />
                  <circle cx={d.x} cy={d.y} r={1.1} fill="#FFC7C2" />
                </g>
              );
            }
            if (isSkipped) {
              return (
                <circle
                  key={d.idx}
                  cx={d.x}
                  cy={d.y}
                  r={1.2}
                  fill="#FF9500"
                  opacity={0.85}
                />
              );
            }
            return (
              <circle
                key={d.idx}
                cx={d.x}
                cy={d.y}
                r={0.9}
                fill="#3A4A63"
                opacity={0.6}
              />
            );
          })}
        </g>
      </svg>

      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center"
        style={{ width: INNER_R * 2, height: INNER_R * 2 }}
      >
        <div className="flex items-baseline gap-0.5">
          <div
            ref={pctRef}
            className="font-display tabular-nums"
            style={{
              fontSize: 30,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              fontWeight: 600,
              background:
                "linear-gradient(180deg, #FFFFFF 0%, #5AC8FA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
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
          Charted
        </div>
      </div>
    </div>
  );
}
