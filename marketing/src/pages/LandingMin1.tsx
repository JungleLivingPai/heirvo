import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import {
  clipReveal,
  staggerReveal,
  magneticHover,
  splitReveal,
  parallaxLayer,
} from "../lib/gsap-fx";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

/* ─────────────────────────────────────────────────────────────────────────────
 * LandingMin1 — /v11
 * "Stark" direction: Apple product page × Linear marketing site
 * Pure white / near-black / two accents only (#0A84FF + #000000)
 * ───────────────────────────────────────────────────────────────────────────── */

const DOWNLOAD_URL: string =
  (import.meta.env.VITE_DOWNLOAD_URL as string) || "#";

// ─── Design tokens ─────────────────────────────────────────────────────────

const C = {
  page:        "#FFFFFF",
  text:        "#0A0A0A",
  textMuted:   "#6B6B6B",
  textFaint:   "#9B9B9B",
  border:      "#E8E8E8",
  borderStrong:"#D0D0D0",
  surface:     "#F7F7F7",
  blue:        "#0A84FF",
  blueHover:   "#0070E0",
  blueFaint:   "rgba(10,132,255,0.08)",
  blueBorder:  "rgba(10,132,255,0.20)",
} as const;

const SORA = '"Sora", ui-sans-serif, system-ui, sans-serif';

// ─── Tiny presentational helpers ────────────────────────────────────────────

function Label({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        fontFamily: SORA,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase" as const,
        color: C.textFaint,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Rule({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      aria-hidden
      style={{ height: 1, background: C.border, width: "100%", ...style }}
    />
  );
}

// ─── Chevron arrow (right) ──────────────────────────────────────────────────

function ChevronRight({ size = 14, color = C.blue }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M9 18l6-6-6-6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Numbered step ──────────────────────────────────────────────────────────

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div
      className="step-item"
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr",
        gap: "0 24px",
        alignItems: "start",
      }}
    >
      {/* Number */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1.5px solid ${C.borderStrong}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: SORA,
          fontSize: 13,
          fontWeight: 600,
          color: C.text,
          letterSpacing: "-0.02em",
        }}
        aria-hidden
      >
        {n}
      </div>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontFamily: SORA,
            fontSize: 15,
            fontWeight: 600,
            color: C.text,
            lineHeight: 1.3,
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: SORA,
            fontSize: 14,
            color: C.textMuted,
            lineHeight: 1.65,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

// ─── Media chip ─────────────────────────────────────────────────────────────

function MediaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: SORA,
        fontSize: 12,
        fontWeight: 500,
        color: C.textMuted,
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

// ─── Recovery type pill ─────────────────────────────────────────────────────

function Pill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 12px",
        borderRadius: 100,
        background: C.surface,
        border: `1px solid ${C.border}`,
        fontFamily: SORA,
        fontSize: 12,
        fontWeight: 500,
        color: C.text,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingMin1() {
  const rootRef        = useRef<HTMLDivElement>(null);
  const heroHeadRef    = useRef<HTMLHeadingElement>(null);
  const heroSubRef     = useRef<HTMLParagraphElement>(null);
  const heroCTAsRef    = useRef<HTMLDivElement>(null);
  const heroImgRef     = useRef<HTMLImageElement>(null);
  const mediaStripRef  = useRef<HTMLDivElement>(null);
  const pillsRef       = useRef<HTMLDivElement>(null);
  const stepsRef       = useRef<HTMLDivElement>(null);
  const mailInRef      = useRef<HTMLDivElement>(null);
  const pricingRef     = useRef<HTMLDivElement>(null);
  const quoteRef       = useRef<HTMLQuoteElement>(null);
  const dlBtnRef       = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      CustomEase.create("stark", "M0,0 C0.22,1 0.36,1 1,1");

      if (reduce) {
        gsap.set(
          ".stark-reveal, .stark-fade, .step-item",
          { opacity: 1, clearProps: "transform,clip-path" }
        );
        return;
      }

      // ── Hero entrance ────────────────────────────────────────────────────

      const heroTl = gsap.timeline({ defaults: { ease: "stark" } });

      if (heroHeadRef.current) {
        try {
          const split = new SplitText(heroHeadRef.current, { type: "lines" });
          gsap.set(split.lines, {
            overflow: "hidden",
            clipPath: "inset(0% 0% 100% 0%)",
          });
          heroTl.to(
            split.lines,
            { clipPath: "inset(0% 0% 0% 0%)", duration: 0.95, stagger: 0.1, delay: 0.1 }
          );
        } catch {
          gsap.set(heroHeadRef.current, { opacity: 1 });
        }
      }

      if (heroSubRef.current) {
        heroTl.fromTo(
          heroSubRef.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.75 },
          "-=0.5"
        );
      }

      if (heroCTAsRef.current) {
        heroTl.fromTo(
          heroCTAsRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.65 },
          "-=0.45"
        );
      }

      if (heroImgRef.current) {
        heroTl.fromTo(
          heroImgRef.current,
          { opacity: 0, scale: 0.96, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: "power3.out" },
          "-=1.0"
        );
      }

      // ── Media strip ──────────────────────────────────────────────────────

      if (mediaStripRef.current) {
        gsap.fromTo(
          mediaStripRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.8,
            scrollTrigger: { trigger: mediaStripRef.current, start: "top 88%", once: true },
          }
        );
      }

      // ── Pills stagger ────────────────────────────────────────────────────

      if (pillsRef.current) {
        staggerReveal(pillsRef.current, "[data-pill]", { y: 20, stagger: 0.06, duration: 0.7 });
      }

      // ── Steps ────────────────────────────────────────────────────────────

      if (stepsRef.current) {
        staggerReveal(stepsRef.current, ".step-item", { y: 28, stagger: 0.1, duration: 0.8 });
      }

      // ── Mail-in box clip reveal ──────────────────────────────────────────

      if (mailInRef.current) {
        clipReveal(mailInRef.current, {
          direction: "up",
          duration: 0.9,
          scrollTrigger: { trigger: mailInRef.current, start: "top 82%", once: true },
        });
      }

      // ── Pricing fade ────────────────────────────────────────────────────

      if (pricingRef.current) {
        staggerReveal(pricingRef.current, ".stark-reveal", { y: 20, stagger: 0.08, duration: 0.75 });
      }

      // ── Quote reveal ─────────────────────────────────────────────────────

      if (quoteRef.current) {
        splitReveal(quoteRef.current, { duration: 0.9, stagger: 0.14 });
      }

      // ── Subtle image parallax in hero ────────────────────────────────────

      if (heroImgRef.current) {
        parallaxLayer(heroImgRef.current, 0.35);
      }
    }, rootRef);

    // Magnetic on download button
    const cleanMagnetic = magneticHover(dlBtnRef.current, 0.22);

    return () => {
      ctx.revert();
      cleanMagnetic();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="landing-min1-root"
      style={{
        background: C.page,
        color: C.text,
        fontFamily: SORA,
        overflowX: "hidden",
      }}
    >
      {/* ─────────────────────────────────────────────────────────────────
          TOP NAV
          ───────────────────────────────────────────────────────────────── */}
      <Nav />

      <main>
        {/* ═══════════════════════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="hero-heading"
          className="hero-section"
          style={{
            minHeight: "92vh",
            display: "grid",
            gridTemplateColumns: "1fr",
            padding: "80px 0 40px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle radial behind hero image — the one permitted glow */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse 55% 60% at 75% 50%, rgba(10,132,255,0.055) 0%, transparent 70%)",
            }}
          />

          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              width: "100%",
              padding: "0 32px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 64,
              alignItems: "center",
            }}
            className="hero-grid"
          >
            {/* Left column */}
            <div style={{ maxWidth: 560 }}>
              {/* Eyebrow */}
              <Label className="mb-6">
                Disc recovery software for Windows
              </Label>

              {/* Headline */}
              <h1
                id="hero-heading"
                ref={heroHeadRef}
                style={{
                  fontFamily: SORA,
                  fontWeight: 700,
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  lineHeight: 1.09,
                  letterSpacing: "-0.03em",
                  color: C.text,
                  marginBottom: 24,
                }}
              >
                Recover memories from any damaged disc.
              </h1>

              {/* Sub */}
              <p
                ref={heroSubRef}
                style={{
                  fontFamily: SORA,
                  fontSize: 18,
                  fontWeight: 400,
                  color: C.textMuted,
                  lineHeight: 1.65,
                  marginBottom: 40,
                  maxWidth: 440,
                  opacity: 0,
                }}
              >
                Heirvo reads failing DVDs sector by sector — through
                scratches, degraded dye, and surface damage that stops
                every other tool. Free to scan. Pay only when you save.
              </p>

              {/* CTAs */}
              <div
                ref={heroCTAsRef}
                style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, alignItems: "center", opacity: 0 }}
              >
                {/* PATH 1 — Primary */}
                <a
                  ref={dlBtnRef}
                  href={DOWNLOAD_URL}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 24px",
                    borderRadius: 10,
                    background: C.text,
                    color: "#FFFFFF",
                    fontFamily: SORA,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                    transition: "background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    whiteSpace: "nowrap" as const,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "#1a1a1a";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.28)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = C.text;
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)";
                  }}
                  aria-label="Download Heirvo free for Windows"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 3v13M6 11l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Download Free for Windows
                </a>

                {/* PATH 2 — Secondary: We'll do it for you */}
                <Link
                  to="/recover"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "14px 20px",
                    borderRadius: 10,
                    background: "transparent",
                    color: C.blue,
                    fontFamily: SORA,
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                    border: `1.5px solid ${C.blueBorder}`,
                    transition: "background 0.15s ease, border-color 0.15s ease",
                    whiteSpace: "nowrap" as const,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = C.blueFaint;
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = C.blue;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = C.blueBorder;
                  }}
                  aria-label="Mail-in disc recovery service"
                >
                  We'll do it for you
                  <ChevronRight size={13} />
                </Link>
              </div>

              {/* Fine print under CTAs */}
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap" as const,
                }}
              >
                {["Free to scan", "Pay $39 to save", "No account needed", "Windows 10 / 11"].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: SORA,
                      fontSize: 11,
                      color: C.textFaint,
                      letterSpacing: "0.01em",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M20 6L9 17l-5-5" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right column — software box */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
              }}
            >
              <img
                ref={heroImgRef}
                src="/assets/box.png"
                alt="Heirvo software box — disc recovery for Windows"
                width={520}
                height={520}
                style={{
                  width: "min(100%, 520px)",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                  opacity: 0,
                  filter: "drop-shadow(0 32px 64px rgba(0,0,0,0.12)) drop-shadow(0 8px 24px rgba(0,0,0,0.08))",
                }}
                loading="eager"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>

          <style>{`
            @media (max-width: 768px) {
              .hero-grid {
                grid-template-columns: 1fr !important;
                gap: 48px !important;
                padding: 0 20px !important;
              }
              .hero-grid > div:last-child {
                display: none;
              }
            }
          `}</style>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SUPPORTED MEDIA STRIP
            ═══════════════════════════════════════════════════════════════ */}
        <div
          ref={mediaStripRef}
          className="media-strip"
          style={{
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
            padding: "22px 32px",
            opacity: 0,
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 0,
              flexWrap: "wrap" as const,
            }}
          >
            <Label style={{ marginRight: 32, marginBottom: 0 }}>Works with</Label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                flexWrap: "wrap" as const,
              }}
            >
              {["DVD", "Photo CD", "Data CD", "Audio CD", "Blu-ray"].map((type, i, arr) => (
                <span key={type} style={{ display: "inline-flex", alignItems: "center" }}>
                  <MediaChip label={type} />
                  {i < arr.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 1,
                        height: 12,
                        background: C.border,
                        margin: "0 16px",
                      }}
                    />
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            WHAT WE RECOVER — pill chips
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="recover-heading"
          className="recover-section"
          style={{
            padding: "96px 32px 80px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <Label className="mb-5">What Heirvo recovers</Label>
            <h2
              id="recover-heading"
              style={{
                fontFamily: SORA,
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: C.text,
                lineHeight: 1.15,
                marginBottom: 24,
              }}
            >
              Every file type that matters.
            </h2>
            <p
              style={{
                fontFamily: SORA,
                fontSize: 16,
                color: C.textMuted,
                lineHeight: 1.7,
                marginBottom: 32,
                maxWidth: 520,
              }}
            >
              From home videos burned in 2003 to professional archives — if
              it's on a disc, Heirvo will attempt to extract it.
            </p>
          </div>

          <div
            ref={pillsRef}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}
          >
            {[
              "Videos",
              "Photos",
              "Music",
              "Documents",
              "Disc images (ISO)",
              "Data files",
              "Audio CDs",
              "Raw sectors",
            ].map((type) => (
              <span key={type} data-pill="true">
                <Pill label={type} />
              </span>
            ))}
          </div>
        </section>

        <Rule />

        {/* ═══════════════════════════════════════════════════════════════
            HOW IT WORKS — 3 numbered steps
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="how-heading"
          style={{
            padding: "96px 32px",
            maxWidth: 1200,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px 80px",
            alignItems: "start",
          }}
          className="how-grid how-section"
        >
          <style>{`
            @media (max-width: 768px) {
              .how-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
            }
          `}</style>

          {/* Left: heading */}
          <div>
            <Label className="mb-5">How it works</Label>
            <h2
              id="how-heading"
              style={{
                fontFamily: SORA,
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: C.text,
                lineHeight: 1.15,
                marginBottom: 20,
              }}
            >
              Three steps. No expertise required.
            </h2>
            <p
              style={{
                fontFamily: SORA,
                fontSize: 15,
                color: C.textMuted,
                lineHeight: 1.7,
                maxWidth: 420,
              }}
            >
              Heirvo handles the complexity. You insert the disc and tell
              it where to save. It does the rest — including trying passes
              that other software skips entirely.
            </p>

            {/* Damaged disc image — secondary visual */}
            <div style={{ marginTop: 40 }}>
              <img
                src="/assets/damaged-disc.png"
                alt="A scratched DVD that Heirvo can still read"
                width={320}
                height={320}
                loading="lazy"
                style={{
                  width: "min(100%, 320px)",
                  height: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.10))",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>

          {/* Right: steps */}
          <div
            ref={stepsRef}
            style={{ display: "flex", flexDirection: "column", gap: 40 }}
          >
            <Step
              n={1}
              title="Insert your disc"
              body="Connect any USB or built-in DVD drive and insert your disc. Heirvo detects the disc type automatically — no settings to configure."
            />
            <div style={{ height: 1, background: C.border }} aria-hidden />
            <Step
              n={2}
              title="Heirvo reads sector by sector, even through damage"
              body="Using low-level SCSI pass-through, Heirvo attempts each failing sector multiple times — at full speed, then half speed, forward then backward. It does what a regular file copy cannot."
            />
            <div style={{ height: 1, background: C.border }} aria-hidden />
            <Step
              n={3}
              title="Save as MP4, ISO, or extract every file"
              body="Choose your output: extract individual files, save a complete ISO image, or let Heirvo convert video automatically to MP4. Your files, your format."
            />
          </div>
        </section>

        <Rule />

        {/* ═══════════════════════════════════════════════════════════════
            "WE DO IT FOR YOU" SECTION — PATH 2
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="mailin-heading"
          className="mailin-section"
          style={{ padding: "80px 32px" }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              ref={mailInRef}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: "56px 64px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "40px 80px",
                alignItems: "center",
              }}
              className="mailin-grid"
            >
              <style>{`
                @media (max-width: 768px) {
                  .mailin-grid { grid-template-columns: 1fr !important; padding: 36px 28px !important; }
                }
              `}</style>

              {/* Text */}
              <div>
                <Label className="mb-4">Mail-in recovery service</Label>
                <h2
                  id="mailin-heading"
                  style={{
                    fontFamily: SORA,
                    fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    color: C.text,
                    lineHeight: 1.2,
                    marginBottom: 16,
                  }}
                >
                  No drive? No time?
                  <br />
                  No problem.
                </h2>
                <p
                  style={{
                    fontFamily: SORA,
                    fontSize: 15,
                    color: C.textMuted,
                    lineHeight: 1.7,
                    maxWidth: 500,
                    marginBottom: 24,
                  }}
                >
                  Mail us your disc. We extract everything using professional
                  equipment, then deliver your files via a secure cloud link
                  — or post a USB drive to you. No equipment to buy, no
                  software to learn.
                </p>

                {/* Key details */}
                <div
                  style={{
                    display: "flex",
                    gap: 32,
                    flexWrap: "wrap" as const,
                    marginBottom: 32,
                  }}
                >
                  {[
                    { label: "Price", value: "From $89" },
                    { label: "Guarantee", value: "No recovery, no charge" },
                    { label: "Delivery", value: "Cloud link or post" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div
                        style={{
                          fontFamily: SORA,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase" as const,
                          color: C.textFaint,
                          marginBottom: 4,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontFamily: SORA,
                          fontSize: 14,
                          fontWeight: 600,
                          color: C.text,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <Link
                    to="/recover"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "12px 20px",
                      borderRadius: 8,
                      background: C.blue,
                      color: "#FFFFFF",
                      fontFamily: SORA,
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      textDecoration: "none",
                      transition: "background 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = C.blueHover;
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 20px rgba(10,132,255,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = C.blue;
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                    }}
                  >
                    Get started
                    <ChevronRight size={13} color="#FFFFFF" />
                  </Link>

                  <Link
                    to="/recover"
                    style={{
                      fontFamily: SORA,
                      fontSize: 13,
                      color: C.textMuted,
                      textDecoration: "none",
                      borderBottom: `1px solid ${C.borderStrong}`,
                      paddingBottom: 1,
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = C.text;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = C.textMuted;
                    }}
                  >
                    Contact us
                  </Link>
                </div>
              </div>

              {/* Right: small illustration */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  alignItems: "center",
                  gap: 16,
                  flexShrink: 0,
                }}
                className="mailin-img-col"
              >
                <style>{`
                  @media (max-width: 900px) { .mailin-img-col { display: none !important; } }
                `}</style>
                <img
                  src="/assets/disc-memories.png"
                  alt="Multiple discs ready for mail-in recovery"
                  width={200}
                  height={200}
                  loading="lazy"
                  style={{
                    width: 200,
                    height: "auto",
                    objectFit: "contain",
                    filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.12))",
                    opacity: 0.9,
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            PRICING
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          className="pricing-section"
          style={{
            padding: "80px 32px 96px",
          }}
        >
          <div
            ref={pricingRef}
            style={{ maxWidth: 1200, margin: "0 auto" }}
          >
            <Label className="mb-5 stark-reveal">Simple pricing</Label>
            <h2
              id="pricing-heading"
              className="stark-reveal"
              style={{
                fontFamily: SORA,
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: C.text,
                lineHeight: 1.15,
                marginBottom: 56,
              }}
            >
              Pay only when you succeed.
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
              }}
              className="pricing-grid stark-reveal"
            >
              <style>{`
                @media (max-width: 640px) {
                  .pricing-grid { grid-template-columns: 1fr !important; }
                }
              `}</style>

              {/* Tier 1 — DIY */}
              <div
                className="pricing-card"
                style={{
                  border: `1.5px solid ${C.text}`,
                  borderRadius: 14,
                  padding: "40px 40px 36px",
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 0,
                  position: "relative" as const,
                }}
              >
                {/* Recommended badge */}
                <span
                  style={{
                    position: "absolute" as const,
                    top: -12,
                    left: 32,
                    background: C.text,
                    color: "#FFFFFF",
                    fontFamily: SORA,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    padding: "3px 10px",
                    borderRadius: 100,
                  }}
                >
                  Most popular
                </span>

                <Label>Software — do it yourself</Label>

                <div
                  style={{
                    fontFamily: SORA,
                    fontSize: 48,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: C.text,
                    lineHeight: 1,
                    marginTop: 20,
                    marginBottom: 4,
                  }}
                >
                  $0
                </div>
                <div
                  style={{
                    fontFamily: SORA,
                    fontSize: 13,
                    color: C.textMuted,
                    marginBottom: 24,
                  }}
                >
                  to scan your disc — pay{" "}
                  <strong style={{ color: C.text, fontWeight: 600 }}>$39</strong>{" "}
                  once to save
                </div>

                <Rule style={{ marginBottom: 24 }} />

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 12,
                    marginBottom: 32,
                  }}
                >
                  {[
                    "Sector-by-sector deep scan",
                    "Unlimited discs",
                    "No subscription, ever",
                    "No account required",
                    "Works offline",
                    "Output: MP4, ISO, or raw files",
                  ].map((feat) => (
                    <li
                      key={feat}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontFamily: SORA,
                        fontSize: 13,
                        color: C.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d="M20 6L9 17l-5-5" stroke={C.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>

                <a
                  href={DOWNLOAD_URL}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "13px 20px",
                    borderRadius: 8,
                    background: C.text,
                    color: "#FFFFFF",
                    fontFamily: SORA,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                    transition: "background 0.15s ease",
                    marginTop: "auto",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "#1a1a1a";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = C.text;
                  }}
                  aria-label="Download Heirvo free for Windows"
                >
                  Download Free for Windows
                </a>
              </div>

              {/* Tier 2 — Mail-in */}
              <div
                className="pricing-card"
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "40px 40px 36px",
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 0,
                  background: C.surface,
                }}
              >
                <Label>Mail-in service — we do it</Label>

                <div
                  style={{
                    fontFamily: SORA,
                    fontSize: 48,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: C.text,
                    lineHeight: 1,
                    marginTop: 20,
                    marginBottom: 4,
                  }}
                >
                  from $89
                </div>
                <div
                  style={{
                    fontFamily: SORA,
                    fontSize: 13,
                    color: C.textMuted,
                    marginBottom: 24,
                  }}
                >
                  No recovery, no charge — guaranteed
                </div>

                <Rule style={{ marginBottom: 24 }} />

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 12,
                    marginBottom: 32,
                  }}
                >
                  {[
                    "Mail us your disc",
                    "Professional extraction equipment",
                    "Files delivered via secure cloud link",
                    "USB drive option available",
                    "Fragile or rare discs welcome",
                    "Response within 2 business days",
                  ].map((feat) => (
                    <li
                      key={feat}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontFamily: SORA,
                        fontSize: 13,
                        color: C.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d="M20 6L9 17l-5-5" stroke={C.blue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/recover"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "13px 20px",
                    borderRadius: 8,
                    background: "transparent",
                    color: C.blue,
                    fontFamily: SORA,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                    border: `1.5px solid ${C.blueBorder}`,
                    transition: "background 0.15s ease, border-color 0.15s ease",
                    marginTop: "auto",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = C.blueFaint;
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = C.blue;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = C.blueBorder;
                  }}
                >
                  Learn more
                  <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Rule />

        {/* ═══════════════════════════════════════════════════════════════
            TESTIMONIAL
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-label="Customer testimonial"
          className="testimonial-section"
          style={{ padding: "112px 32px 120px" }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            {/* Opening mark */}
            <div
              aria-hidden
              style={{
                fontFamily: SORA,
                fontSize: 80,
                lineHeight: 0.8,
                color: C.borderStrong,
                marginBottom: 32,
                fontWeight: 700,
                letterSpacing: "-0.04em",
              }}
            >
              "
            </div>

            <blockquote
              ref={quoteRef}
              style={{
                fontFamily: SORA,
                fontSize: "clamp(1.25rem, 2.5vw, 1.875rem)",
                fontWeight: 400,
                color: C.text,
                lineHeight: 1.45,
                letterSpacing: "-0.015em",
                margin: 0,
                padding: 0,
                border: "none",
              }}
            >
              It read the disc nine times. The ninth pass found my daughter's
              first birthday.
            </blockquote>

            <figcaption
              style={{
                marginTop: 32,
                fontFamily: SORA,
                fontSize: 12,
                fontWeight: 500,
                color: C.textFaint,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
              }}
            >
              A. Marsh · Vermont
            </figcaption>
          </div>
        </section>

        <Rule />

        {/* ═══════════════════════════════════════════════════════════════
            FINAL CTA BAND
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="final-cta-heading"
          className="final-cta-section"
          style={{ padding: "96px 32px" }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "40px 64px",
              alignItems: "center",
            }}
            className="cta-grid"
          >
            <style>{`
              @media (max-width: 640px) {
                .cta-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>

            <div>
              <h2
                id="final-cta-heading"
                style={{
                  fontFamily: SORA,
                  fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: C.text,
                  lineHeight: 1.2,
                  marginBottom: 12,
                }}
              >
                Start recovering today — it's free to scan.
              </h2>
              <p
                style={{
                  fontFamily: SORA,
                  fontSize: 14,
                  color: C.textMuted,
                  lineHeight: 1.65,
                  maxWidth: 440,
                }}
              >
                Download Heirvo and run a full scan at no cost. See exactly
                what's recoverable before you decide to save.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column" as const,
                gap: 12,
                alignItems: "flex-start",
                flexShrink: 0,
              }}
            >
              <a
                href={DOWNLOAD_URL}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 24px",
                  borderRadius: 10,
                  background: C.text,
                  color: "#FFFFFF",
                  fontFamily: SORA,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  textDecoration: "none",
                  transition: "background 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  whiteSpace: "nowrap" as const,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#1a1a1a";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.28)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = C.text;
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)";
                }}
                aria-label="Download Heirvo free for Windows"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3v13M6 11l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Download Free for Windows
              </a>

              <Link
                to="/recover"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: SORA,
                  fontSize: 13,
                  color: C.textMuted,
                  textDecoration: "none",
                  padding: "4px 0",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = C.blue;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = C.textMuted;
                }}
              >
                Or mail us your disc — we'll do it for you
                <ChevronRight size={12} color="currentColor" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────────
          FOOTER
          ───────────────────────────────────────────────────────────────── */}
      <Footer />

      <style>{`
        .landing-min1-root ~ * { }
        .landing-min1-bg-fix body,
        body:has(.landing-min1-root) {
          background: #FFFFFF !important;
          background-image: none !important;
        }

        @media (max-width: 768px) {
          .hero-section {
            padding-top: clamp(48px, 10vw, 80px) !important;
            padding-bottom: 32px !important;
            min-height: unset !important;
          }
          .media-strip {
            padding: 18px 16px !important;
          }
          .recover-section {
            padding: 64px 20px 48px !important;
          }
          .how-section {
            padding: 64px 20px !important;
          }
          .mailin-section {
            padding: 56px 20px !important;
          }
          .pricing-section {
            padding: 56px 20px 72px !important;
          }
          .testimonial-section {
            padding: 72px 20px 80px !important;
          }
          .final-cta-section {
            padding: 64px 20px !important;
          }
          .cta-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .pricing-card {
            padding: 28px 24px 24px !important;
          }
        }

        @media (max-width: 480px) {
          .media-strip {
            padding: 16px 16px !important;
          }
          .recover-section {
            padding: 48px 16px 40px !important;
          }
          .how-section {
            padding: 48px 16px !important;
          }
          .mailin-section {
            padding: 40px 16px !important;
          }
          .mailin-grid {
            padding: 28px 20px !important;
          }
          .pricing-section {
            padding: 48px 16px 56px !important;
          }
          .testimonial-section {
            padding: 56px 16px 64px !important;
          }
          .final-cta-section {
            padding: 48px 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
