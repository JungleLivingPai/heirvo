import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { splitReveal, clipReveal, magneticHover, parallaxLayer } from "../../lib/gsap-fx";

const DOWNLOAD_URL =
  import.meta.env.VITE_DOWNLOAD_URL ||
  "https://github.com/your-username/heirvo/releases/latest/download/Heirvo_0.1.0_setup.exe";

/**
 * Hero — conversion-focused, two-column layout.
 *
 * PRIMARY goal: get users to download the free Heirvo tool.
 * SECONDARY path: /recover mail-in service for those without a drive.
 */
export default function Hero() {
  const scopeRef     = useRef<HTMLElement>(null);
  const headlineRef  = useRef<HTMLHeadingElement>(null);
  const pillRef      = useRef<HTMLDivElement>(null);
  const subRef       = useRef<HTMLParagraphElement>(null);
  const ctasRef      = useRef<HTMLDivElement>(null);
  const trustRef     = useRef<HTMLDivElement>(null);
  const dlBtnRef     = useRef<HTMLAnchorElement>(null);
  const boxWrapRef   = useRef<HTMLDivElement>(null);
  const boxImgRef    = useRef<HTMLImageElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    if (!scopeRef.current) return;

    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      // ── Pill + subtext + CTAs stagger in ──────────────────────────────
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(pillRef.current, { y: 12, opacity: 0, duration: 0.65 }, 0)
        .from(subRef.current,  { y: 18, opacity: 0, duration: 0.85 }, 0.6)
        .from(
          ctasRef.current?.children ? Array.from(ctasRef.current.children) : [],
          { y: 14, opacity: 0, duration: 0.65, stagger: 0.1 },
          0.78
        )
        .from(trustRef.current, { y: 10, opacity: 0, duration: 0.6 }, 1.0)
        .from(boxWrapRef.current, { scale: 0.93, opacity: 0, duration: 1.4, ease: "expo.out" }, 0.05);

      // ── Headline — splitReveal line by line ───────────────────────────
      // Small delay so the pill lands first
      const killSplit = splitReveal(headlineRef.current, { delay: 0.1, stagger: 0.13 });
      cleanups.push(killSplit);

      // ── Box image — clip reveal from right, triggered immediately ─────
      const killClip = clipReveal(boxImgRef.current, {
        direction: "right",
        duration: 1.05,
        delay: 0.2,
        scrollTrigger: { trigger: boxImgRef.current, start: "top 95%" },
      });
      cleanups.push(killClip);

      // ── Parallax drift on the box as page scrolls ─────────────────────
      const killParallax = parallaxLayer(boxWrapRef.current, 0.4);
      cleanups.push(killParallax);

      // ── Magnetic hover on the download button ─────────────────────────
      const killMagnetic = magneticHover(dlBtnRef.current, 0.28);
      cleanups.push(killMagnetic);
    }, scopeRef);

    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
    };
  }, [reducedMotion]);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════ HERO */}
      <section
        ref={scopeRef}
        className="relative overflow-hidden min-h-[94vh] flex items-center"
      >
        {/* Layered backdrop */}
        <div className="mesh-bg" />
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(900px 600px at 70% 20%, rgba(10,132,255,0.14), transparent 60%)," +
              "radial-gradient(600px 400px at 15% 80%, rgba(90,200,250,0.10), transparent 60%)",
          }}
          aria-hidden
        />
        {/* Subtle grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.032] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
          aria-hidden
        />

        <div className="container-narrow relative pt-16 pb-24 sm:pt-24 sm:pb-32 w-full">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">

            {/* ── LEFT — copy & CTAs ───────────────────────────────────── */}
            <div>
              {/* Pill badge */}
              <div
                ref={pillRef}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/75 backdrop-blur px-3.5 py-1.5 mb-8 text-[12px] font-medium text-ink-600 shadow-sm"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                Free to download&nbsp;&middot;&nbsp;Windows
              </div>

              {/* Headline */}
              <h1
                ref={headlineRef}
                className="font-display font-bold tracking-tightest text-ink-900"
                style={{
                  fontSize: "clamp(34px, 5vw, 60px)",
                  lineHeight: 1.07,
                  letterSpacing: "-0.03em",
                  maxWidth: "15ch",
                }}
              >
                Your damaged discs{" "}
                <span className="text-brand-500">still have stories</span>{" "}
                to tell.
              </h1>

              {/* Subtext */}
              <p
                ref={subRef}
                className="mt-6 text-[18px] sm:text-[19px] leading-relaxed text-ink-500 max-w-[520px]"
              >
                Recover videos, photos, music, and documents from damaged{" "}
                <span className="text-ink-700 font-medium">DVDs, photo CDs, data CDs, audio CDs, and Blu-ray</span>{" "}
                — discs other software gives up on.{" "}
                <span className="text-ink-700 font-medium">Free to scan.</span>{" "}
                $39 to save.
              </p>

              {/* CTAs */}
              <div ref={ctasRef} className="mt-9 flex flex-col sm:flex-row flex-wrap gap-3">
                {/* PRIMARY — download */}
                <a
                  ref={dlBtnRef}
                  href={DOWNLOAD_URL}
                  className="btn btn-primary group inline-flex items-center gap-2 text-[15px] px-6 py-3.5"
                  style={{ display: "inline-flex" }}
                >
                  <DownloadIcon />
                  Download Free — Windows
                  <span
                    className="ml-0.5 opacity-80 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    &rarr;
                  </span>
                </a>

                {/* SECONDARY — mail-in */}
                <Link
                  to="/recover"
                  className="btn btn-ghost inline-flex items-center gap-1.5 text-[14px] text-ink-600 hover:text-ink-900 border border-ink-200 px-5 py-3.5 rounded-xl transition-colors"
                >
                  Don't have a DVD drive? We'll do it for you
                  <span aria-hidden className="opacity-60">&rarr;</span>
                </Link>
              </div>

              {/* Trust micro-row */}
              <div
                ref={trustRef}
                className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-500"
              >
                <span className="flex items-center gap-2">
                  <CheckIcon /> Free to scan
                </span>
                <span className="flex items-center gap-2">
                  <CheckIcon /> No account needed
                </span>
                <span className="flex items-center gap-2">
                  <CheckIcon /> Runs on your computer
                </span>
              </div>

              {/* Supported media + files — answers "will this work for me?" */}
              <div className="mt-8 pt-7 border-t border-ink-100">
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mb-3 font-medium">
                  Works with
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["DVD Video", "Photo CD", "Data CD", "Audio CD", "Blu-ray", "DVD-R / DVD+R"].map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center rounded-full border border-ink-200 bg-white/80 px-3 py-1 text-[12px] font-medium text-ink-700"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mb-3 font-medium">
                  Recovers
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Videos", detail: "MP4, VOB, M2TS" },
                    { label: "Photos", detail: "JPEG, PNG, TIFF" },
                    { label: "Music", detail: "WAV, FLAC" },
                    { label: "Documents", detail: "PDF, DOC, ZIP" },
                    { label: "Disc images", detail: "ISO" },
                  ].map((f) => (
                    <span
                      key={f.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700"
                    >
                      {f.label}
                      <span className="text-brand-400 font-normal">{f.detail}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT — box.png with float + glow ───────────────────── */}
            <div className="relative flex justify-center lg:justify-end mt-10 lg:mt-0">
              {/* Soft radial glow behind box */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full -z-10"
                style={{
                  background:
                    "radial-gradient(circle, rgba(10,132,255,0.18) 0%, rgba(90,200,250,0.10) 40%, transparent 72%)",
                }}
                aria-hidden
              />

              <div
                ref={boxWrapRef}
                className="relative"
                style={{ animation: reducedMotion ? undefined : "boxFloat 4s ease-in-out infinite" }}
              >
                <img
                  ref={boxImgRef}
                  src="/assets/box.png"
                  alt="Heirvo DVD & Disc Recovery Software box"
                  width={420}
                  height={520}
                  className="w-[300px] sm:w-[360px] lg:w-[420px] h-auto object-contain"
                  style={{
                    filter: "drop-shadow(0 32px 64px rgba(10,132,255,0.22)) drop-shadow(0 8px 24px rgba(0,0,0,0.18))",
                  }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Float + hero-word keyframes */}
        <style>{`
          @keyframes boxFloat {
            0%,  100% { transform: translateY(0px); }
            50%        { transform: translateY(-12px); }
          }
          .hero-word { display: inline-block; }
        `}</style>
      </section>

      {/* ════════════════════════════════════════════════ HANDOFF BAND */}
      <HandOffBand />
    </>
  );
}

/* ─── HandOff Band ──────────────────────────────────────────────────────────── */
function HandOffBand() {
  return (
    <div
      className="w-full flex items-center"
      style={{
        background: "#0B1220",
        minHeight: "80px",
      }}
    >
      <div className="container-narrow w-full py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            <span
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
              style={{ background: "rgba(10,132,255,0.15)" }}
              aria-hidden
            >
              <MailIcon />
            </span>
            <p className="text-[14px] text-slate-300 leading-snug">
              <span className="text-white font-medium">Don't have a DVD drive at home?</span>{" "}
              No problem.
            </p>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <p className="hidden md:block text-[13px] text-slate-400 leading-snug">
              Send us your disc — we recover it.{" "}
              <span className="text-slate-300">No recovery, no charge.</span>
            </p>
            <Link
              to="/recover"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-400 hover:text-white border border-brand-500/40 hover:border-brand-400 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Mail us your disc
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7.5L5.5 11L12 3.5"
        stroke="#34C759"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5v9m0 0L4.5 7m3.5 3.5L11.5 7M2 13h12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="#0A84FF" strokeWidth="1.5" />
      <path d="M2 6.5l7 4.5 7-4.5" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
