import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * BeforeAfter — A draggable slider revealing a stylized "BEFORE" (aged DVD rip)
 * vs "AFTER" (recovered + restored) frame. Uses pure SVG/CSS, no video assets.
 */
export default function BeforeAfter() {
  const scopeRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // percentage 0-100
  const draggingRef = useRef(false);

  // Scroll-trigger reveal animations
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-ba-head]", {
        opacity: 0,
        y: 24,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: scopeRef.current, start: "top 75%" },
      });
      gsap.from("[data-ba-frame]", {
        opacity: 0,
        y: 40,
        scale: 0.97,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: scopeRef.current, start: "top 70%" },
      });
      gsap.from("[data-ba-meta]", {
        opacity: 0,
        y: 16,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.06,
        scrollTrigger: { trigger: scopeRef.current, start: "top 65%" },
      });
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(2, Math.min(98, next)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(2, p - 4));
    if (e.key === "ArrowRight") setPos((p) => Math.min(98, p + 4));
    if (e.key === "Home") setPos(2);
    if (e.key === "End") setPos(98);
  };

  return (
    <section
      id="demo"
      ref={scopeRef}
      className="relative py-24 sm:py-32 overflow-hidden"
    >
      <div className="container-narrow">
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div data-ba-head className="micro-label mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-ink-300" />
            What you get back
          </div>
          <h2
            data-ba-head
            className="font-display font-bold tracking-tightest text-ink-900"
            style={{ fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.04 }}
          >
            Before Heirvo. <span className="gradient-text">After Heirvo.</span>
          </h2>
          <p
            data-ba-head
            className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-2xl"
          >
            Drag the divider. Left is what an aged, scratched DVD looks like
            when it barely plays. Right is what Heirvo pulls out and, with AI
            restoration, brings back to life.
          </p>
        </div>

        <div
          data-ba-frame
          className="relative mx-auto max-w-[920px]"
        >
          {/* Soft gradient halo behind the frame */}
          <div className="absolute -inset-8 rounded-[40px] bg-brand-gradient-soft blur-3xl opacity-70 pointer-events-none" />

          {/* CRT bezel */}
          <div
            className="relative rounded-[28px] p-3 sm:p-4"
            style={{
              background:
                "linear-gradient(160deg, #0A1729 0%, #162033 50%, #04091A 100%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.05) inset, 0 30px 80px rgba(10,23,41,0.35)",
            }}
          >
            {/* Frame surface */}
            <div
              ref={frameRef}
              className="relative rounded-[18px] overflow-hidden select-none"
              style={{ aspectRatio: "16 / 10" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* AFTER (full layer underneath) */}
              <AfterScene />

              {/* BEFORE (clipped) */}
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              >
                <BeforeScene />
              </div>

              {/* Divider line + handle */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${pos}%` }}
              >
                <div
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(10,132,255,0.95) 50%, rgba(255,255,255,0.95) 100%)",
                    boxShadow: "0 0 18px rgba(10,132,255,0.55)",
                  }}
                />
              </div>

              <button
                type="button"
                role="slider"
                aria-label="Compare before and after"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pos)}
                tabIndex={0}
                onKeyDown={onKeyDown}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-12 w-12 rounded-full bg-white shadow-glass-lg ring-2 ring-brand-500/40 hover:ring-brand-500/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing"
                style={{ left: `${pos}%` }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
                  <path
                    d="M8 5l-4 6 4 6M14 5l4 6-4 6"
                    stroke="#0A84FF"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Corner labels */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] uppercase text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-ios-orange" />
                  Before
                </span>
              </div>
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] uppercase text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-ios-green" />
                  After
                </span>
              </div>
            </div>

            {/* Bezel detail row */}
            <div className="mt-3 flex items-center justify-between px-2 sm:px-3 text-white/40 text-[10px] tracking-[0.2em] uppercase">
              <span className="tabular-nums">CH 03 · 00:14:22</span>
              <span className="hidden sm:inline">Family wedding · 2003</span>
              <span className="tabular-nums">DVD-R · 4.3GB</span>
            </div>
          </div>

          {/* Stat callouts beneath */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <Stat data-ba-meta value="98.4%" label="Sectors recovered" />
            <Stat data-ba-meta value="4×" label="Resolution upscale" />
            <Stat data-ba-meta value="0" label="Files uploaded" />
            <Stat data-ba-meta value="MP4" label="Save when ready" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  ...rest
}: {
  value: string;
  label: string;
  [k: string]: unknown;
}) {
  return (
    <div {...rest}>
      <div
        className="font-display font-bold tabular-nums tracking-tightest gradient-text leading-none"
        style={{ fontSize: "clamp(28px, 3.6vw, 42px)" }}
      >
        {value}
      </div>
      <div className="mt-2 text-[12px] uppercase tracking-[0.14em] text-ink-500 font-medium">
        {label}
      </div>
    </div>
  );
}

/* ---------------- Stylized scenes ---------------- */

/** AFTER — clean, vibrant, restored */
function AfterScene() {
  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="skyAfter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE2A8" />
            <stop offset="50%" stopColor="#FFB47A" />
            <stop offset="100%" stopColor="#E96A6A" />
          </linearGradient>
          <linearGradient id="seaAfter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D7AB5" />
            <stop offset="100%" stopColor="#0A2640" />
          </linearGradient>
          <radialGradient id="sunAfter" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFF6CD" />
            <stop offset="100%" stopColor="rgba(255,200,100,0)" />
          </radialGradient>
        </defs>
        {/* Sky */}
        <rect width="800" height="320" fill="url(#skyAfter)" />
        {/* Sun glow */}
        <circle cx="540" cy="260" r="180" fill="url(#sunAfter)" />
        <circle cx="540" cy="260" r="44" fill="#FFF1B8" />
        {/* Distant hills */}
        <path
          d="M0 290 Q 140 250 280 280 T 540 270 T 800 285 L 800 320 L 0 320 Z"
          fill="#5C2D5E"
          opacity="0.85"
        />
        <path
          d="M0 305 Q 180 275 360 295 T 800 300 L 800 320 L 0 320 Z"
          fill="#3A1F44"
          opacity="0.9"
        />
        {/* Sea */}
        <rect y="320" width="800" height="180" fill="url(#seaAfter)" />
        {/* Sun reflection */}
        <ellipse cx="540" cy="335" rx="60" ry="6" fill="#FFE2A0" opacity="0.85" />
        <ellipse cx="540" cy="360" rx="40" ry="3" fill="#FFE2A0" opacity="0.6" />
        <ellipse cx="540" cy="380" rx="28" ry="2" fill="#FFE2A0" opacity="0.4" />
        {/* Foreground silhouettes — two figures */}
        <g fill="#0A1018" opacity="0.95">
          {/* Adult */}
          <ellipse cx="220" cy="345" rx="14" ry="14" />
          <path d="M204 360 Q 220 354 236 360 L 240 460 L 200 460 Z" />
          {/* Child */}
          <ellipse cx="252" cy="370" rx="10" ry="10" />
          <path d="M242 380 Q 252 376 262 380 L 264 460 L 240 460 Z" />
          {/* Holding hands */}
          <path
            d="M232 388 Q 240 384 248 388"
            stroke="#0A1018"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        {/* Ground */}
        <rect y="455" width="800" height="45" fill="#0A0A12" />
      </svg>
    </div>
  );
}

/** BEFORE — magenta-tinted, washed out, scanlines, dropouts */
function BeforeScene() {
  return (
    <div className="absolute inset-0">
      {/* Same scene, desaturated and tinted */}
      <div
        className="absolute inset-0"
        style={{
          filter: "saturate(0.55) contrast(0.78) brightness(0.85)",
        }}
      >
        <AfterScene />
      </div>
      {/* Magenta VHS-from-DVD tint */}
      <div
        className="absolute inset-0 mix-blend-color pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(220,60,140,0.55) 0%, rgba(180,40,120,0.45) 60%, rgba(60,30,80,0.5) 100%)",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50 mix-blend-multiply"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0 1px, transparent 1px 3px)",
        }}
      />
      {/* RGB shift band */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0,
          right: 0,
          top: "38%",
          height: "12%",
          background:
            "linear-gradient(90deg, rgba(255,0,80,0.08) 0%, rgba(0,200,255,0.08) 100%)",
          mixBlendMode: "screen",
        }}
      />
      {/* Dropout / read-error blocks */}
      <svg
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden
      >
        <rect x="120" y="180" width="60" height="14" fill="#0A1729" opacity="0.85" />
        <rect x="500" y="120" width="36" height="10" fill="#0A1729" opacity="0.7" />
        <rect x="640" y="380" width="80" height="20" fill="#0A1729" opacity="0.85" />
        <rect x="80" y="430" width="24" height="8" fill="#0A1729" opacity="0.6" />
        {/* Tracking glitch lines */}
        <rect x="0" y="245" width="800" height="2" fill="rgba(255,255,255,0.4)" />
        <rect x="0" y="247" width="800" height="1" fill="rgba(255,80,140,0.6)" />
      </svg>
      {/* Soft blur overall */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backdropFilter: "blur(0.6px)" }}
      />
    </div>
  );
}
