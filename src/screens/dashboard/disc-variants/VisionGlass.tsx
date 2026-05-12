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

/**
 * VisionGlass — Apple Vision Pro inspired translucent crystal puck.
 *
 * A volumetric glass puck floating in space. Multi-layer translucency,
 * subtle internal refraction, mouse-parallax tilt, breathing halo aura.
 * Sectors emerge as faint gleams from inside the crystal — depth is the
 * material, not motion. Quiet, ethereal, premium.
 */
export default function VisionGlass({ isActive, pct }: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const lastPctRef = useRef<number>(-1);

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

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!scopeRef.current) return;
    const ctx = gsap.context(() => {
      // Halo breathing — slow scale + opacity
      if (haloRef.current) {
        gsap.to(haloRef.current, {
          scale: 1.08,
          opacity: 0.85,
          duration: 3.4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
      // Subtle puck float — vertical bob
      if (puckRef.current) {
        gsap.to(puckRef.current, {
          y: -4,
          duration: 4.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
      // Mouse parallax tilt
      const onMove = (e: MouseEvent) => {
        const rect = scopeRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(scopeRef.current, {
          rotateY: px * 8,
          rotateX: -py * 6,
          x: px * -6,
          y: py * -4,
          duration: 1.0,
          ease: "power3.out",
          transformPerspective: 800,
        });
      };
      window.addEventListener("mousemove", onMove);
      return () => window.removeEventListener("mousemove", onMove);
    }, scopeRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={scopeRef}
      className="relative will-change-transform"
      style={{ width: SIZE, height: SIZE, perspective: 800 }}
      aria-hidden
    >
      {/* Soft halo aura behind the puck */}
      <div
        ref={haloRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.45) 0%, rgba(90,200,250,0.18) 50%, transparent 75%)",
          filter: "blur(28px)",
          opacity: 0.65,
        }}
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          filter: "drop-shadow(0 24px 50px rgba(10,23,41,0.18))",
        }}
      >
        <defs>
          {/* Glass material — frosted with internal depth */}
          <radialGradient id="vg-body" cx="0.4" cy="0.35" r="0.85">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#E1F0FF" stopOpacity="0.6" />
            <stop offset="65%" stopColor="#9FC0E8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#5483B8" stopOpacity="0.55" />
          </radialGradient>

          {/* Inner light — sectors emerge as gleams INSIDE the crystal */}
          <radialGradient id="vg-inner" cx="0.5" cy="0.55" r="0.45">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#5AC8FA" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </radialGradient>

          {/* Top highlight — premium gleam */}
          <linearGradient id="vg-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Edge ring — beveled crystal lip */}
          <linearGradient id="vg-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.55" />
          </linearGradient>

          {/* Frost blur for translucent depth */}
          <filter id="vg-frost" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        <g ref={puckRef}>
          {/* Outermost soft ring (atmospheric edge) */}
          <circle
            cx={C}
            cy={C}
            r={C - 14}
            fill="none"
            stroke="rgba(10,132,255,0.22)"
            strokeWidth={1.2}
          />

          {/* Crystal body — frosted */}
          <circle
            cx={C}
            cy={C}
            r={C - 22}
            fill="url(#vg-body)"
            filter="url(#vg-frost)"
          />

          {/* Beveled edge ring */}
          <circle
            cx={C}
            cy={C}
            r={C - 22}
            fill="none"
            stroke="url(#vg-edge)"
            strokeWidth={2}
            opacity={0.85}
          />

          {/* Inner refraction depth — sectors emerge as gleam */}
          <circle
            cx={C}
            cy={C}
            r={C - 38}
            fill="url(#vg-inner)"
            style={{ mixBlendMode: "screen" }}
            opacity={0.55 + (pct / 100) * 0.45}
          />

          {/* Faint internal facet rings (depth cue) */}
          {Array.from({ length: 4 }, (_, i) => (
            <circle
              key={i}
              cx={C}
              cy={C}
              r={C - 30 - i * 18}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={0.6}
            />
          ))}

          {/* Top highlight crescent — premium gleam */}
          <ellipse
            cx={C - 16}
            cy={C - 56}
            rx={62}
            ry={20}
            fill="url(#vg-highlight)"
            opacity={0.85}
            transform={`rotate(-20 ${C - 16} ${C - 56})`}
          />

          {/* Hairline progress arc on the bezel */}
          <circle
            cx={C}
            cy={C}
            r={C - 22}
            fill="none"
            stroke="rgba(10,132,255,0.85)"
            strokeWidth={2}
            strokeDasharray={`${(2 * Math.PI * (C - 22) * (pct / 100)).toFixed(2)} ${2 * Math.PI * (C - 22)}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${C} ${C})`}
            style={{ filter: "drop-shadow(0 0 6px rgba(10,132,255,0.7))" }}
          />
        </g>
      </svg>

      {/* Centered % readout overlay */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
      >
        <div className="font-display text-[11px] uppercase tracking-[0.18em] text-ink-500">
          {isActive ? "Recovering" : "Paused"}
        </div>
        <div className="mt-1 flex items-baseline gap-0.5">
          <span
            ref={pctRef}
            className="font-display text-[42px] font-semibold tabular-nums leading-none text-ink-900"
            style={{ letterSpacing: "-0.025em" }}
          >
            0
          </span>
          <span className="text-[16px] font-semibold text-ink-500">%</span>
        </div>
      </div>
    </div>
  );
}
