import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Hero brand disc — a stylized rendering of the Heirvo mark:
 * a prismatic DVD with a recovery arc circling it and broken-glass
 * shards spalling from the left edge. Designed for the hero focal point.
 *
 * Animations (mount, gated by reduced-motion in parent):
 *  - SECTOR REVEAL: on first paint, the disc materializes — the body
 *    fades in from center outward and concentric "sector" pings spiral
 *    outward as if Heirvo is reading the disc for the first time.
 *  - SCRATCH HEALS: every ~7s a faint scratch line draws across the
 *    surface; a vertical band of light then sweeps L→R across the disc;
 *    the scratch fades behind the sweep and tiny sparkles emit from
 *    where the band passes — visualizing recovery in motion.
 *  - Disc spins slowly and continuously (subtle, ~60s/rev)
 *  - Memory sparkles drift upward at random intervals
 *  - Broken shards drift outward with subtle parallax
 *  - Recovery arrow sweeps around the rim (decorative, static for now)
 */

const SIZE = 460;
const C = SIZE / 2;
const DISC_R = C - 36;

// Pre-baked sparkle starting offsets so the layout is stable on SSR
const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  // angle around disc center (deg), 0 = straight up
  angle: -110 + Math.random() * 220, // mostly upper hemisphere
  // distance from center where sparkle starts
  radius: 90 + Math.random() * 70,
  size: 2 + Math.random() * 3,
  delay: Math.random() * 4,
  duration: 3.4 + Math.random() * 2.6,
}));

// Broken-glass shards — relative to disc center, in the spalling left region
const SHARDS = [
  { x: -180, y: -40, rot: -18, scale: 1.0, d: "M0 0 L34 -8 L40 14 L18 28 Z" },
  { x: -200, y: 28, rot: 12, scale: 0.85, d: "M0 0 L26 -4 L32 18 L8 22 Z" },
  { x: -160, y: 80, rot: -28, scale: 0.7, d: "M0 0 L22 6 L26 22 L4 16 Z" },
  { x: -210, y: -90, rot: 24, scale: 0.7, d: "M0 0 L20 -10 L24 6 L4 12 Z" },
  { x: -150, y: -120, rot: -8, scale: 0.55, d: "M0 0 L16 -2 L18 14 L2 12 Z" },
];

// Concentric "sector reveal" pings — staggered radii spiraling outward.
// 8 rings at 30%-100% of disc radius — they pulse outward on mount.
const SECTOR_RINGS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  radius: DISC_R * (0.3 + i * 0.09), // 0.30, 0.39, 0.48 ... up to 0.93
  delay: 0.25 + i * 0.14,
}));

interface Props {
  reducedMotion: boolean;
}

export default function HeroBrandDisc({ reducedMotion }: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<SVGGElement>(null);
  const discBodyRef = useRef<SVGGElement>(null);
  const sparkleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const shardRefs = useRef<(SVGPathElement | null)[]>([]);
  const sectorRingRefs = useRef<(SVGCircleElement | null)[]>([]);
  // Heal-loop refs
  const scratchRef = useRef<SVGPathElement>(null);
  const healBandRef = useRef<SVGRectElement>(null);
  const healSparkRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    if (reducedMotion) return;
    if (!scopeRef.current) return;

    const ctx = gsap.context(() => {
      /* -----------------------------------------------------------------
       * SECTOR REVEAL — one-shot on mount
       *
       * Effect: disc body scales from 0.85→1 with a fade-in, while 8
       * concentric "sector rings" pulse outward in a spiral. Feels like
       * Heirvo is *reading* the disc and bringing it back to life.
       * ---------------------------------------------------------------- */
      if (discBodyRef.current) {
        gsap.set(discBodyRef.current, {
          opacity: 0,
          scale: 0.85,
          transformOrigin: `${C}px ${C}px`,
        });
        gsap.to(discBodyRef.current, {
          opacity: 1,
          scale: 1,
          duration: 1.4,
          ease: "expo.out",
          delay: 0.1,
        });
      }

      sectorRingRefs.current.forEach((el, i) => {
        if (!el) return;
        const ring = SECTOR_RINGS[i];
        gsap.set(el, { opacity: 0, attr: { r: 0 } });
        gsap.to(el, {
          attr: { r: ring.radius },
          opacity: 0.7,
          duration: 0.55,
          ease: "power2.out",
          delay: ring.delay,
        });
        gsap.to(el, {
          opacity: 0,
          duration: 0.7,
          ease: "power2.in",
          delay: ring.delay + 0.55,
        });
      });

      /* -----------------------------------------------------------------
       * Slow continuous rotation (subtle, 60s/rev)
       * ---------------------------------------------------------------- */
      if (discRef.current) {
        gsap.to(discRef.current, {
          rotate: 360,
          duration: 60,
          ease: "none",
          repeat: -1,
          transformOrigin: `${C}px ${C}px`,
          delay: 1.4, // Wait for sector reveal to complete
        });
      }

      /* -----------------------------------------------------------------
       * SCRATCH HEALS — looping every ~7s
       *
       * 1. Scratch fades in (stroke-dashoffset = 0)
       * 2. A vertical bright band wipes left → right across the disc
       * 3. Scratch fades out behind the band
       * 4. Tiny sparkles emit from where the band passes
       * ---------------------------------------------------------------- */
      if (scratchRef.current && healBandRef.current) {
        const scratch = scratchRef.current;
        const band = healBandRef.current;
        const length = scratch.getTotalLength();
        gsap.set(scratch, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: 0,
        });
        gsap.set(band, { x: -200, opacity: 0 });

        const buildHealCycle = () => {
          const tl = gsap.timeline({ delay: 3 });
          // 1. Scratch draws in over 0.5s
          tl.to(scratch, { opacity: 0.55, duration: 0.2 }, 0)
            .to(
              scratch,
              { strokeDashoffset: 0, duration: 0.5, ease: "power1.out" },
              0,
            );
          // 2. Band sweeps L→R over ~1.6s
          tl.to(
            band,
            {
              x: SIZE,
              opacity: 0.85,
              duration: 1.6,
              ease: "power2.inOut",
            },
            "+=0.3",
          );
          // 3. Scratch fades out behind the band
          tl.to(
            scratch,
            { opacity: 0, duration: 0.6, ease: "power2.in" },
            "-=1.2",
          );
          // 4. Heal sparkles burst as the band passes (synced near end)
          healSparkRefs.current.forEach((el, i) => {
            if (!el) return;
            // Distribute sparkles vertically across the disc face
            const yOffset = (i - 3) * 28 + (Math.random() - 0.5) * 12;
            const startX = SIZE * 0.5 + (Math.random() - 0.5) * 30;
            const startY = C + yOffset;
            const endY = startY - 50 - Math.random() * 40;
            gsap.set(el, { cx: startX, cy: startY, opacity: 0, r: 0 });
            tl.to(
              el,
              {
                opacity: 0.95,
                attr: { r: 1.8 + Math.random() * 1.2 },
                duration: 0.25,
                ease: "power2.out",
              },
              `-=${1.4 - i * 0.12}`,
            ).to(
              el,
              {
                cy: endY,
                opacity: 0,
                attr: { r: 0.3 },
                duration: 0.9,
                ease: "sine.out",
              },
              `-=${0.05}`,
            );
          });
          // 5. Reset band position invisibly
          tl.to(band, { x: -200, opacity: 0, duration: 0 });
          // Repeat
          tl.call(buildHealCycle);
          return tl;
        };
        buildHealCycle();
      }

      /* -----------------------------------------------------------------
       * Sparkles — drift upward + fade (existing)
       * ---------------------------------------------------------------- */
      sparkleRefs.current.forEach((el, i) => {
        if (!el) return;
        const s = SPARKLES[i];
        const angleRad = (s.angle * Math.PI) / 180;
        const startX = Math.cos(angleRad) * s.radius;
        const startY = Math.sin(angleRad) * s.radius;
        const endX = startX + (Math.random() - 0.5) * 60;
        const endY = startY - 90 - Math.random() * 60;

        gsap.set(el, { x: startX, y: startY, opacity: 0, scale: 0.6 });
        gsap.to(el, {
          keyframes: [
            { x: startX, y: startY, opacity: 0, scale: 0.4, duration: 0 },
            { opacity: 0.9, scale: 1, duration: s.duration * 0.25 },
            { opacity: 0, x: endX, y: endY, scale: 0.5, duration: s.duration * 0.75 },
          ],
          ease: "sine.out",
          repeat: -1,
          delay: s.delay + 1.2, // Wait for sector reveal
          repeatDelay: Math.random() * 1.5,
        });
      });

      /* -----------------------------------------------------------------
       * Shards — gentle parallax breathing (existing)
       * ---------------------------------------------------------------- */
      shardRefs.current.forEach((el, i) => {
        if (!el) return;
        const dir = i % 2 === 0 ? -1 : 1;
        gsap.to(el, {
          x: `+=${dir * 4}`,
          y: `+=${dir * 3}`,
          rotate: `+=${dir * 2}`,
          duration: 6 + i * 0.4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });

      /* -----------------------------------------------------------------
       * Mouse parallax (existing)
       * ---------------------------------------------------------------- */
      const onMove = (e: MouseEvent) => {
        const rect = scopeRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(scopeRef.current, {
          x: px * -16,
          y: py * -10,
          duration: 0.9,
          ease: "power3.out",
        });
      };
      window.addEventListener("mousemove", onMove);

      return () => {
        window.removeEventListener("mousemove", onMove);
      };
    }, scopeRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div
      ref={scopeRef}
      className="relative will-change-transform"
      style={{ width: SIZE, height: SIZE }}
      aria-hidden
    >
      {/* Soft cyan halo */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.30), rgba(90,200,250,0.14) 50%, transparent 75%)",
          filter: "blur(28px)",
        }}
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ filter: "drop-shadow(0 30px 60px rgba(10,23,41,0.20))" }}
      >
        <defs>
          {/* Prismatic disc gradient — navy w/ rainbow glint */}
          <radialGradient id="discBody" cx="0.4" cy="0.35" r="0.85">
            <stop offset="0%" stopColor="#1A3A6B" />
            <stop offset="35%" stopColor="#0E2548" />
            <stop offset="70%" stopColor="#091A36" />
            <stop offset="100%" stopColor="#04091A" />
          </radialGradient>
          <linearGradient id="discPrism" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.6" />
            <stop offset="30%" stopColor="#A78BFA" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#F472B6" stopOpacity="0.35" />
            <stop offset="80%" stopColor="#FBBF24" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34C759" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#5AC8FA" />
          </linearGradient>
          <radialGradient id="hubGrad" cx="0.5" cy="0.4" r="0.8">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E6EEF8" />
            <stop offset="100%" stopColor="#9AA6B8" />
          </radialGradient>
          <radialGradient id="sparkGrad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#5AC8FA" />
            <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
          </radialGradient>

          {/* Healing sweep band — vertical bright gradient */}
          <linearGradient id="healBandGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#5AC8FA" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </linearGradient>

          {/* Mask so spalled edge is irregular on the left */}
          <mask id="discMask">
            <rect width={SIZE} height={SIZE} fill="white" />
            <circle cx={C - 168} cy={C - 30} r={22} fill="black" />
            <circle cx={C - 180} cy={C + 36} r={18} fill="black" />
            <circle cx={C - 158} cy={C + 88} r={14} fill="black" />
            <circle cx={C - 172} cy={C - 92} r={14} fill="black" />
          </mask>

          {/* Clip the heal band + its sparkles to the disc circle so they
              don't bleed onto the surrounding shards. */}
          <clipPath id="discClip">
            <circle cx={C} cy={C} r={DISC_R} />
          </clipPath>
        </defs>

        {/* Outer glow ring */}
        <circle
          cx={C}
          cy={C}
          r={C - 18}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth={1.5}
          opacity={0.35}
        />

        {/* Recovery arc (3/4 sweep, decorative) */}
        <circle
          cx={C}
          cy={C}
          r={C - 12}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${(2 * Math.PI * (C - 12)) * 0.62} ${(2 * Math.PI * (C - 12)) * 0.38}`}
          opacity={0.85}
          transform={`rotate(-110 ${C} ${C})`}
        />
        {/* Arrowhead at end of arc */}
        <g transform={`translate(${C + (C - 12) * Math.cos((-110 + 0.62 * 360 - 90) * Math.PI / 180)} ${C + (C - 12) * Math.sin((-110 + 0.62 * 360 - 90) * Math.PI / 180)})`}>
          <path
            d="M0 0 L-12 -7 L-9 0 L-12 7 Z"
            fill="url(#arcGrad)"
            transform={`rotate(${-110 + 0.62 * 360})`}
          />
        </g>

        {/* The disc body wrapper (sector-reveal pop-in) */}
        <g ref={discBodyRef}>
          {/* Disc spin group (rotates) */}
          <g ref={discRef} mask="url(#discMask)">
            {/* Body */}
            <circle cx={C} cy={C} r={DISC_R} fill="url(#discBody)" />
            {/* Prismatic glint */}
            <circle cx={C} cy={C} r={DISC_R} fill="url(#discPrism)" opacity={0.7} style={{ mixBlendMode: "screen" }} />
            {/* Concentric data rings for sheen */}
            {Array.from({ length: 18 }, (_, i) => {
              const r = DISC_R - (i * (C - 60) / 18);
              return (
                <circle
                  key={i}
                  cx={C}
                  cy={C}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
              );
            })}
            {/* Bright streak */}
            <ellipse
              cx={C - 30}
              cy={C - 70}
              rx={70}
              ry={18}
              fill="rgba(255,255,255,0.18)"
              transform={`rotate(-25 ${C - 30} ${C - 70})`}
            />
            {/* Hub */}
            <circle cx={C} cy={C} r={42} fill="url(#hubGrad)" />
            <circle cx={C} cy={C} r={14} fill="#04091A" />
            <circle cx={C} cy={C} r={5} fill="#5AC8FA" />
          </g>

          {/* Scratch + healing sweep + heal sparkles, clipped to disc circle */}
          <g clipPath="url(#discClip)">
            {/* Scratch line — diagonal, faint, draws in then fades behind sweep */}
            <path
              ref={scratchRef}
              d={`M ${C - DISC_R * 0.7} ${C - DISC_R * 0.35} Q ${C} ${C - DISC_R * 0.05} ${C + DISC_R * 0.65} ${C + DISC_R * 0.4}`}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
              opacity={0}
            />

            {/* Healing sweep band — vertical, sweeps left to right */}
            <rect
              ref={healBandRef}
              x={-40}
              y={C - DISC_R}
              width={80}
              height={DISC_R * 2}
              fill="url(#healBandGrad)"
              opacity={0}
              style={{ mixBlendMode: "screen" }}
            />

            {/* Heal sparkles emitted as the band passes */}
            {Array.from({ length: 7 }, (_, i) => (
              <circle
                key={`heal-${i}`}
                ref={(el) => (healSparkRefs.current[i] = el)}
                cx={C}
                cy={C}
                r={0}
                fill="url(#sparkGrad)"
                opacity={0}
              />
            ))}
          </g>

          {/* Sector-reveal pings — concentric rings spiraling outward on mount */}
          <g>
            {SECTOR_RINGS.map((ring, i) => (
              <circle
                key={ring.id}
                ref={(el) => (sectorRingRefs.current[i] = el)}
                cx={C}
                cy={C}
                r={0}
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth={1.2}
                opacity={0}
              />
            ))}
          </g>
        </g>

        {/* Broken-glass shards (outside the disc rotation/reveal group) */}
        <g>
          {SHARDS.map((s, i) => (
            <path
              key={i}
              ref={(el) => (shardRefs.current[i] = el)}
              d={s.d}
              transform={`translate(${C + s.x} ${C + s.y}) rotate(${s.rot}) scale(${s.scale})`}
              fill="url(#discPrism)"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={0.8}
              opacity={0.85}
              style={{ filter: "drop-shadow(0 4px 8px rgba(10,23,41,0.30))" }}
            />
          ))}
        </g>

        {/* Memory sparkles drifting up (existing) */}
        <g>
          {SPARKLES.map((s, i) => (
            <circle
              key={s.id}
              ref={(el) => (sparkleRefs.current[i] = el)}
              cx={C}
              cy={C}
              r={s.size}
              fill="url(#sparkGrad)"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
