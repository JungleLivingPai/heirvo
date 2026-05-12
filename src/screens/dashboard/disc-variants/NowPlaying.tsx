import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "@/utils/gsap-fx";

interface Props {
  buckets: number[];
  totalSectors: number;
  isActive: boolean;
  pct: number;
}

const SIZE = 240;
const C = SIZE / 2;
const DISC_R = C - 38;

/**
 * NowPlaying — Apple Music / Apple TV "Now Playing" inspired.
 *
 * A clean glass disc resting on a reflective glass surface. Realistic
 * depth shadow, slow rotation, refraction highlight on the surface,
 * mirror reflection beneath. Cinematic, refined, premium-archival.
 */
export default function NowPlaying({ isActive, pct }: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<SVGGElement>(null);
  const reflectionRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

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

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!scopeRef.current) return;
    const ctx = gsap.context(() => {
      // Slow continuous rotation — only when active
      const targets = [discRef.current, reflectionRef.current].filter(Boolean);
      const tween = isActive
        ? gsap.to(targets, {
            rotate: 360,
            duration: 30,
            ease: "none",
            repeat: -1,
            transformOrigin: `${C}px ${C}px`,
          })
        : null;
      return () => {
        tween?.kill();
      };
    }, scopeRef);
    return () => ctx.revert();
  }, [isActive]);

  return (
    <div
      ref={scopeRef}
      className="relative"
      style={{ width: SIZE, height: SIZE + 60 }}
      aria-hidden
    >
      {/* Soft warm-grey backdrop gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(244,246,250,0) 0%, rgba(225,230,238,0.55) 65%, rgba(225,230,238,0.85) 100%)",
        }}
      />

      <svg width={SIZE} height={SIZE + 60} viewBox={`0 0 ${SIZE} ${SIZE + 60}`}>
        <defs>
          {/* Disc body — clean glass with depth */}
          <radialGradient id="np-body" cx="0.4" cy="0.35" r="0.85">
            <stop offset="0%" stopColor="#FAFCFF" />
            <stop offset="35%" stopColor="#E1E9F4" />
            <stop offset="70%" stopColor="#9FB3CC" />
            <stop offset="100%" stopColor="#5A6F8C" />
          </radialGradient>

          {/* Prismatic surface glint */}
          <linearGradient id="np-prism" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.28" />
            <stop offset="35%" stopColor="#A78BFA" stopOpacity="0.22" />
            <stop offset="65%" stopColor="#F472B6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.22" />
          </linearGradient>

          {/* Top highlight — premium glass gleam */}
          <linearGradient id="np-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Hub center — metallic */}
          <radialGradient id="np-hub" cx="0.5" cy="0.4" r="0.8">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#D8E1EC" />
            <stop offset="100%" stopColor="#7C8DA3" />
          </radialGradient>

          {/* Reflection fade mask */}
          <linearGradient id="np-reflMask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <mask id="np-reflMaskApply">
            <rect
              x="0"
              y={C}
              width={SIZE}
              height={SIZE / 2 + 60}
              fill="url(#np-reflMask)"
            />
          </mask>
        </defs>

        {/* Reflection (mirror) — drawn first so the disc sits over it */}
        <g
          ref={reflectionRef}
          mask="url(#np-reflMaskApply)"
          transform={`scale(1, -0.55) translate(0, ${-2 * C - 30})`}
          style={{ filter: "blur(0.6px)" }}
          opacity={0.5}
        >
          <circle cx={C} cy={C} r={DISC_R} fill="url(#np-body)" />
          <circle
            cx={C}
            cy={C}
            r={DISC_R}
            fill="url(#np-prism)"
            opacity={0.7}
            style={{ mixBlendMode: "screen" }}
          />
          <circle cx={C} cy={C} r={28} fill="url(#np-hub)" />
          <circle cx={C} cy={C} r={9} fill="#1F2A3A" />
        </g>

        {/* Floor line — soft horizontal */}
        <line
          x1={20}
          y1={C + DISC_R + 4}
          x2={SIZE - 20}
          y2={C + DISC_R + 4}
          stroke="rgba(10,23,41,0.10)"
          strokeWidth={0.6}
        />

        {/* Drop shadow under disc (separate from drop-shadow filter for soft floor) */}
        <ellipse
          cx={C}
          cy={C + DISC_R + 8}
          rx={DISC_R - 12}
          ry={5}
          fill="rgba(10,23,41,0.18)"
          style={{ filter: "blur(6px)" }}
        />

        {/* The disc */}
        <g
          ref={discRef}
          style={{ filter: "drop-shadow(0 14px 28px rgba(10,23,41,0.20))" }}
        >
          <circle cx={C} cy={C} r={DISC_R} fill="url(#np-body)" />
          <circle
            cx={C}
            cy={C}
            r={DISC_R}
            fill="url(#np-prism)"
            opacity={0.85}
            style={{ mixBlendMode: "screen" }}
          />
          {/* Faint data rings */}
          {Array.from({ length: 12 }, (_, i) => (
            <circle
              key={i}
              cx={C}
              cy={C}
              r={DISC_R - i * (DISC_R / 12)}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.6}
            />
          ))}
          {/* Top highlight crescent */}
          <ellipse
            cx={C - 14}
            cy={C - 50}
            rx={50}
            ry={16}
            fill="url(#np-highlight)"
            opacity={0.85}
            transform={`rotate(-22 ${C - 14} ${C - 50})`}
          />
          {/* Hairline progress arc on the rim */}
          <circle
            cx={C}
            cy={C}
            r={DISC_R + 4}
            fill="none"
            stroke="rgba(10,132,255,0.85)"
            strokeWidth={1.6}
            strokeDasharray={`${(2 * Math.PI * (DISC_R + 4) * (pct / 100)).toFixed(2)} ${2 * Math.PI * (DISC_R + 4)}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${C} ${C})`}
            style={{ filter: "drop-shadow(0 0 4px rgba(10,132,255,0.6))" }}
          />
          {/* Hub */}
          <circle cx={C} cy={C} r={28} fill="url(#np-hub)" />
          <circle cx={C} cy={C} r={9} fill="#1F2A3A" />
          <circle cx={C} cy={C} r={3} fill="#5AC8FA" />
        </g>
      </svg>

      {/* Combined readout below the disc — Apple Music "Now Playing" style */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex items-baseline justify-center gap-1.5"
        style={{ top: SIZE + 10 }}
      >
        <div className="flex items-baseline gap-0.5">
          <span
            ref={pctRef}
            className="font-display text-[20px] font-semibold tabular-nums leading-none text-ink-900"
            style={{ letterSpacing: "-0.025em" }}
          >
            0
          </span>
          <span className="text-[12px] font-semibold text-ink-500">%</span>
        </div>
        <span className="text-ink-300">·</span>
        <div className="font-display text-[10px] uppercase tracking-[0.20em] text-ink-500">
          {isActive ? "Recovering" : "Paused"}
        </div>
      </div>
    </div>
  );
}
