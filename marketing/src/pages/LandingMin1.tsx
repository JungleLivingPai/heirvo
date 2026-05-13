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
 * LandingMin1 — Editorial Dark direction
 * Navy/near-black background, large editorial typography, film-grain feel.
 * Targets the memory/nostalgia angle. Owns Kodak Photo CD niche.
 * SEO: DVD recovery software, recover files from damaged disc, Kodak Photo CD
 * ───────────────────────────────────────────────────────────────────────────── */

const DOWNLOAD_URL: string =
  (import.meta.env.VITE_DOWNLOAD_URL as string) || "#";

// ─── Design tokens ─────────────────────────────────────────────────────────

const C = {
  // Dark editorial palette
  page:         "#0B1220",
  pageAlt:      "#0E1628",
  pageMid:      "#111827",
  text:         "#F0EDE8",
  textMuted:    "#94A3B8",
  textFaint:    "#5E7290",
  border:       "rgba(255,255,255,0.08)",
  borderMed:    "rgba(255,255,255,0.12)",
  borderBright: "rgba(255,255,255,0.20)",
  // Accents
  blue:         "#0A84FF",
  blueHover:    "#3B9EFF",
  blueFaint:    "rgba(10,132,255,0.12)",
  blueBorder:   "rgba(10,132,255,0.30)",
  // Photo CD amber
  amber:        "#F59E0B",
  amberHover:   "#FBB03B",
  amberFaint:   "rgba(245,158,11,0.10)",
  amberBorder:  "rgba(245,158,11,0.25)",
  amberGlow:    "rgba(245,158,11,0.06)",
  // Film grain overlay
  grain:        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
} as const;

const SORA = '"Sora", ui-sans-serif, system-ui, sans-serif';

// ─── Structured data (JSON-LD) ──────────────────────────────────────────────

const HOW_TO_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to recover files from a damaged DVD or CD",
  "description": "Recover photos, videos, and data from scratched, damaged, or unreadable DVDs, CDs, and Kodak Photo CDs using Heirvo disc recovery software for Windows.",
  "tool": [{ "@type": "HowToTool", "name": "Heirvo DVD recovery software" }],
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Insert your disc",
      "text": "Connect a USB or internal disc drive to your Windows PC and insert your damaged DVD, CD, or Blu-ray. Heirvo detects the disc type automatically — no configuration needed."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Run the free scan",
      "text": "Click Scan. Heirvo reads the disc sector by sector, making multiple passes over damaged areas that other software skips. The scan is completely free — you only pay to save the files."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Save your recovered files",
      "text": "Preview what was found, then pay once ($39) to save everything. Choose to extract individual files, save a full ISO image, or have Heirvo convert video to MP4 automatically."
    }
  ]
});

const FAQ_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I recover files from a scratched DVD?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Heirvo is DVD recovery software specifically designed for scratched and damaged discs. It reads each sector multiple times at different speeds — forward and backward — to recover data that a standard file copy would miss entirely. The free scan shows exactly what is recoverable before you pay anything."
      }
    },
    {
      "@type": "Question",
      "name": "What is the best software to recover files from a damaged CD or DVD?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Heirvo is purpose-built disc recovery software for Windows 10 and 11. Unlike older tools such as IsoBuster, Heirvo is designed for non-technical users recovering family memories. It supports DVD, CD, Blu-ray, and Kodak Photo CD formats. The scan is free; saving files costs a one-time fee of $39 with no subscription."
      }
    },
    {
      "@type": "Question",
      "name": "How do I open Kodak Photo CD files on Windows 10 or 11?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Kodak Photo CDs use the .PCD format, which modern Windows no longer opens natively — and Adobe Photoshop dropped support in 2023. Heirvo reads Kodak Photo CDs directly, extracts the full-resolution images, and converts them to standard JPEG or TIFF files you can view on any device."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a free DVD recovery tool for Windows?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Heirvo offers a completely free scan — you can see every recoverable file on your disc before spending anything. If you want to save those files, a one-time payment of $39 unlocks unlimited saves. There is no subscription, no account required, and no recurring fee."
      }
    },
    {
      "@type": "Question",
      "name": "What discs does Heirvo support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Heirvo supports DVD, DVD-R, DVD+R, DVD-RW, DVD+RW, Data CD, Audio CD, CD-R, CD-RW, Blu-ray, BD-R, Kodak Photo CD (.PCD), and burned discs. It works with any USB or internal disc drive connected to a Windows 10 or Windows 11 PC (64-bit)."
      }
    },
    {
      "@type": "Question",
      "name": "What if I don't have a disc drive, or the disc is too badly damaged for software?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Heirvo offers a mail-in recovery service starting at $89 per disc. You post your disc to our lab, and our team uses professional optical recovery equipment to extract your files. The guarantee is simple: if we cannot recover anything, you pay nothing. Files are delivered via a secure cloud link within 10–14 days."
      }
    },
    {
      "@type": "Question",
      "name": "Will Windows Defender flag Heirvo as a virus?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Windows SmartScreen may show a warning the first time you run Heirvo because it is new software without a large install history yet. This is a standard caution for any newly released application, not an indication of malware. Click 'More info' then 'Run anyway' to proceed. Heirvo contains no malware, adware, or tracking software."
      }
    }
  ]
});

const SOFTWARE_APP_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Heirvo",
  "operatingSystem": "Windows 10, Windows 11",
  "applicationCategory": "UtilitiesApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free to scan. $39 one-time to save recovered files."
  },
  "description": "DVD and CD recovery software for Windows. Recovers files from scratched, damaged, or unreadable DVDs, CDs, Blu-ray, and Kodak Photo CDs.",
  "url": "https://heirvo.com"
});

// ─── Tiny helpers ────────────────────────────────────────────────────────────

function CheckIcon({ color = C.blue, size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight({ size = 14, color = C.blue }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontFamily: SORA,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      color: C.textFaint,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Rule({ style }: { style?: React.CSSProperties }) {
  return <div aria-hidden style={{ height: 1, background: C.border, width: "100%", ...style }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingMin1() {
  const rootRef         = useRef<HTMLDivElement>(null);
  const heroHeadRef     = useRef<HTMLHeadingElement>(null);
  const heroSubRef      = useRef<HTMLParagraphElement>(null);
  const heroCTAsRef     = useRef<HTMLDivElement>(null);
  const heroVisualRef   = useRef<HTMLDivElement>(null);
  const mediaStripRef   = useRef<HTMLDivElement>(null);
  const testimonialRef  = useRef<HTMLDivElement>(null);
  const photocdRef      = useRef<HTMLElement>(null);
  const pathsRef        = useRef<HTMLDivElement>(null);
  const stepsRef        = useRef<HTMLDivElement>(null);
  const pricingRef      = useRef<HTMLDivElement>(null);
  const faqRef          = useRef<HTMLDivElement>(null);
  const finalCtaRef     = useRef<HTMLDivElement>(null);
  const dlBtnRef        = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Inject JSON-LD structured data
    const schemas = [HOW_TO_SCHEMA, FAQ_SCHEMA, SOFTWARE_APP_SCHEMA];
    const scriptEls = schemas.map((schema) => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.textContent = schema;
      document.head.appendChild(el);
      return el;
    });

    // Update page title + meta
    const prevTitle = document.title;
    document.title = "Heirvo — DVD & CD Recovery Software for Windows | Free Scan";
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = metaDesc?.content ?? "";
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      "Recover files from scratched DVDs, damaged CDs, Blu-ray, and Kodak Photo CDs. Free to scan. Pay $39 once to save. Mail-in service from $89 with no-recovery/no-charge guarantee. Windows 10 & 11.";

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      CustomEase.create("editorial", "M0,0 C0.22,1 0.36,1 1,1");
      CustomEase.create("reveal", "M0,0 C0.76,0 0.24,1 1,1");

      if (reduce) {
        gsap.set(".ed-reveal, .ed-fade, .step-item, .faq-item, .path-card, .pricing-card", {
          opacity: 1,
          clearProps: "transform,clip-path",
        });
        return;
      }

      // ── Hero entrance ────────────────────────────────────────────────────

      const heroTl = gsap.timeline({ defaults: { ease: "editorial" } });

      if (heroHeadRef.current) {
        try {
          const split = new SplitText(heroHeadRef.current, { type: "lines" });
          gsap.set(split.lines, { overflow: "hidden", clipPath: "inset(0% 0% 100% 0%)" });
          heroTl.to(split.lines, {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.1,
            stagger: 0.11,
            delay: 0.15,
          });
        } catch {
          gsap.set(heroHeadRef.current, { opacity: 1 });
        }
      }

      if (heroSubRef.current) {
        heroTl.fromTo(
          heroSubRef.current,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.8 },
          "-=0.55"
        );
      }

      if (heroCTAsRef.current) {
        heroTl.fromTo(
          heroCTAsRef.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.65 },
          "-=0.45"
        );
      }

      if (heroVisualRef.current) {
        heroTl.fromTo(
          heroVisualRef.current,
          { opacity: 0, scale: 0.94, y: 24 },
          { opacity: 1, scale: 1, y: 0, duration: 1.3, ease: "power3.out" },
          "-=1.1"
        );
        parallaxLayer(heroVisualRef.current, 0.3);
      }

      // ── Media strip ──────────────────────────────────────────────────────

      if (mediaStripRef.current) {
        gsap.fromTo(
          mediaStripRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.9,
            scrollTrigger: { trigger: mediaStripRef.current, start: "top 90%", once: true },
          }
        );
      }

      // ── Testimonials stagger ─────────────────────────────────────────────

      if (testimonialRef.current) {
        staggerReveal(testimonialRef.current, ".testi-card", { y: 32, stagger: 0.1, duration: 0.85 });
      }

      // ── Photo CD section clip reveal ─────────────────────────────────────

      if (photocdRef.current) {
        clipReveal(photocdRef.current, {
          direction: "up",
          duration: 1.0,
          scrollTrigger: { trigger: photocdRef.current, start: "top 80%", once: true },
        });
      }

      // ── Two paths cards ───────────────────────────────────────────────────

      if (pathsRef.current) {
        staggerReveal(pathsRef.current, ".path-card", { y: 36, stagger: 0.12, duration: 0.9 });
      }

      // ── Steps stagger ────────────────────────────────────────────────────

      if (stepsRef.current) {
        staggerReveal(stepsRef.current, ".step-item", { y: 28, stagger: 0.1, duration: 0.8 });
      }

      // ── Pricing cards ────────────────────────────────────────────────────

      if (pricingRef.current) {
        staggerReveal(pricingRef.current, ".pricing-card", { y: 28, stagger: 0.1, duration: 0.8 });
      }

      // ── FAQ accordion items ──────────────────────────────────────────────

      if (faqRef.current) {
        staggerReveal(faqRef.current, ".faq-item", { y: 20, stagger: 0.07, duration: 0.7 });
      }

      // ── Final CTA ────────────────────────────────────────────────────────

      if (finalCtaRef.current) {
        splitReveal(finalCtaRef.current.querySelector("h2"), { duration: 1.0, stagger: 0.13 });
        gsap.fromTo(
          finalCtaRef.current.querySelector(".cta-actions"),
          { opacity: 0, y: 20 },
          {
            opacity: 1, y: 0, duration: 0.75,
            scrollTrigger: { trigger: finalCtaRef.current, start: "top 75%", once: true },
          }
        );
      }
    }, rootRef);

    const cleanMagnetic = magneticHover(dlBtnRef.current, 0.2);

    return () => {
      ctx.revert();
      cleanMagnetic();
      // Restore page meta
      document.title = prevTitle;
      if (metaDesc) metaDesc.content = prevDesc;
      scriptEls.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="lm1-root"
      style={{ background: C.page, color: C.text, fontFamily: SORA, overflowX: "hidden", position: "relative" }}
    >
      {/* Film grain layer */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9999,
          backgroundImage: C.grain,
          backgroundSize: "200px 200px",
          opacity: 0.35,
          mixBlendMode: "overlay",
        }}
      />

      <Nav />

      <main>

        {/* ═══════════════════════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="hero-heading"
          className="lm1-hero"
          style={{
            minHeight: "94vh",
            display: "flex",
            alignItems: "center",
            padding: "100px 0 60px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Ambient background glows */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 70% at 15% 50%, rgba(10,132,255,0.07) 0%, transparent 65%)",
          }} />
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 50% 60% at 85% 40%, rgba(245,158,11,0.04) 0%, transparent 60%)",
          }} />
          {/* Subtle grid lines */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }} />

          <div className="lm1-container lm1-hero-grid">
            {/* Left — copy */}
            <div style={{ maxWidth: 620 }}>
              <Eyebrow style={{ marginBottom: 24 }}>
                DVD Recovery Software · Windows 10 &amp; 11
              </Eyebrow>

              <h1
                id="hero-heading"
                ref={heroHeadRef}
                style={{
                  fontFamily: SORA,
                  fontWeight: 700,
                  fontSize: "clamp(2.6rem, 5.5vw, 4.25rem)",
                  lineHeight: 1.06,
                  letterSpacing: "-0.035em",
                  color: C.text,
                  marginBottom: 28,
                }}
              >
                Recover files from{" "}
                <em style={{ fontStyle: "normal", color: C.blue }}>any</em>{" "}
                damaged disc.
              </h1>

              <p
                ref={heroSubRef}
                style={{
                  fontFamily: SORA,
                  fontSize: "clamp(15px, 1.8vw, 18px)",
                  fontWeight: 400,
                  color: C.textMuted,
                  lineHeight: 1.7,
                  marginBottom: 44,
                  maxWidth: 480,
                  opacity: 0,
                }}
              >
                Heirvo is DVD recovery software that reads failing discs
                sector by sector — through scratches, degraded dye, and
                surface damage that stops every other tool. Free to scan.
                Pay $39 once to save.
              </p>

              {/* CTAs */}
              <div ref={heroCTAsRef} style={{ opacity: 0 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, alignItems: "center", marginBottom: 20 }}>
                  <a
                    ref={dlBtnRef}
                    href={DOWNLOAD_URL}
                    aria-label="Download Heirvo DVD recovery software free for Windows"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 9,
                      padding: "15px 26px", borderRadius: 10,
                      background: C.blue, color: "#FFFFFF",
                      fontFamily: SORA, fontSize: 14, fontWeight: 700,
                      letterSpacing: "-0.01em", textDecoration: "none",
                      transition: "background 0.18s ease, box-shadow 0.18s ease",
                      boxShadow: "0 4px 24px rgba(10,132,255,0.35)",
                      whiteSpace: "nowrap" as const,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = C.blueHover;
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 36px rgba(10,132,255,0.50)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = C.blue;
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(10,132,255,0.35)";
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 3v13M6 11l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Download Free for Windows
                  </a>

                  <Link
                    to="/recover"
                    aria-label="Mail-in disc recovery service — we recover your disc for you"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "14px 22px", borderRadius: 10,
                      background: "transparent", color: C.text,
                      fontFamily: SORA, fontSize: 14, fontWeight: 500,
                      letterSpacing: "-0.01em", textDecoration: "none",
                      border: `1.5px solid ${C.borderMed}`,
                      transition: "border-color 0.18s ease, color 0.18s ease",
                      whiteSpace: "nowrap" as const,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = C.borderBright;
                      (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = C.borderMed;
                      (e.currentTarget as HTMLElement).style.color = C.text;
                    }}
                  >
                    Mail us your disc
                    <ChevronRight size={13} color="currentColor" />
                  </Link>
                </div>

                {/* Trust micro-signals */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
                  {[
                    "Free to scan",
                    "$39 one-time · no subscription",
                    "Windows 10 / 11 · 64-bit",
                    "No account needed",
                  ].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontFamily: SORA, fontSize: 11, color: C.textFaint,
                        letterSpacing: "0.01em",
                      }}
                    >
                      <CheckIcon size={10} color={C.blue} />
                      {tag}
                    </span>
                  ))}
                </div>

                {/* SmartScreen note */}
                <p style={{
                  marginTop: 14,
                  fontFamily: SORA, fontSize: 11,
                  color: C.textFaint, lineHeight: 1.6,
                  maxWidth: 420,
                }}>
                  <strong style={{ color: C.textMuted }}>SmartScreen warning?</strong>{" "}
                  New software. Click "More info" → "Run anyway". No malware, no adware — ever.
                </p>
              </div>
            </div>

            {/* Right — disc visual with ambient ring */}
            <div
              ref={heroVisualRef}
              style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                position: "relative", opacity: 0,
              }}
            >
              {/* Ambient glow behind disc */}
              <div aria-hidden style={{
                position: "absolute",
                width: 380, height: 380,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(10,132,255,0.15) 0%, rgba(10,132,255,0.04) 50%, transparent 70%)",
                filter: "blur(40px)",
              }} />
              {/* Abstract disc rings — CSS-only illustration */}
              <div
                aria-label="Abstract illustration of a scratched optical disc"
                role="img"
                style={{ position: "relative", width: 360, height: 360 }}
              >
                {[360, 300, 240, 180, 120, 60].map((d, i) => (
                  <div
                    key={d}
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: d, height: d,
                      borderRadius: "50%",
                      border: `1px solid rgba(255,255,255,${0.03 + i * 0.018})`,
                      background: i === 5
                        ? "radial-gradient(circle, rgba(10,132,255,0.18) 0%, transparent 70%)"
                        : "transparent",
                    }}
                  />
                ))}
                {/* Scratch lines */}
                {[12, 67, 145, 203, 278, 330].map((deg, i) => (
                  <div
                    key={deg}
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: "50%", left: "50%",
                      width: 2, height: `${90 + i * 12}px`,
                      background: `rgba(255,255,255,${0.04 + i * 0.01})`,
                      transformOrigin: "top center",
                      transform: `translate(-50%, 20%) rotate(${deg}deg)`,
                      borderRadius: 2,
                    }}
                  />
                ))}
                {/* Centre hub */}
                <div aria-hidden style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 32, height: 32, borderRadius: "50%",
                  background: C.pageMid,
                  border: `1px solid ${C.borderMed}`,
                  boxShadow: "0 0 0 4px rgba(10,132,255,0.12)",
                }} />
                {/* Recovery status indicator */}
                <div aria-hidden style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(40px, -80px)",
                  background: C.pageMid,
                  border: `1px solid ${C.borderMed}`,
                  borderRadius: 10, padding: "10px 14px",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  minWidth: 160,
                }}>
                  <div style={{ fontFamily: SORA, fontSize: 10, fontWeight: 700, color: C.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                    Scanning disc
                  </div>
                  <div style={{ fontFamily: SORA, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    3,842 files found
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "73%", background: C.blue, borderRadius: 2, boxShadow: "0 0 8px rgba(10,132,255,0.6)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            .lm1-hero-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 64px;
              align-items: center;
            }
            @media (max-width: 860px) {
              .lm1-hero-grid {
                grid-template-columns: 1fr !important;
                gap: 56px !important;
              }
              .lm1-hero-grid > div:last-child {
                display: none;
              }
            }
          `}</style>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SOCIAL PROOF STRIP — 3 testimonials
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-label="Customer testimonials"
          style={{ padding: "0 0 80px", borderTop: `1px solid ${C.border}` }}
        >
          <div
            ref={testimonialRef}
            className="lm1-container lm1-testi-grid"
            style={{ paddingTop: 64 }}
          >
            {[
              {
                quote: "It read the disc nine times. The ninth pass found my daughter's first birthday.",
                name: "A. Marsh",
                location: "Vermont",
              },
              {
                quote: "I thought those 400 family photos from 1997 were gone forever. Heirvo got 389 of them back in an hour.",
                name: "T. Okonkwo",
                location: "Texas",
              },
              {
                quote: "My dad's Kodak Photo CD from 1993. Nothing else on Windows 11 could open them. Heirvo extracted every single one.",
                name: "R. Bergström",
                location: "Minnesota",
              },
            ].map(({ quote, name, location }) => (
              <article
                key={name}
                className="testi-card"
                style={{
                  background: C.pageAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "32px 28px",
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 20,
                  opacity: 0,
                }}
              >
                <div aria-hidden style={{
                  fontFamily: SORA, fontSize: 36, lineHeight: 0.7,
                  color: C.blue, fontWeight: 700, opacity: 0.6,
                }}>
                  "
                </div>
                <blockquote style={{
                  margin: 0, padding: 0,
                  fontFamily: SORA, fontSize: 15, fontWeight: 400,
                  color: C.text, lineHeight: 1.65,
                  letterSpacing: "-0.01em",
                  flex: 1,
                }}>
                  {quote}
                </blockquote>
                <figcaption style={{
                  fontFamily: SORA, fontSize: 11, fontWeight: 600,
                  color: C.textFaint, letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                }}>
                  {name} · {location}
                </figcaption>
              </article>
            ))}
          </div>

          <style>{`
            .lm1-testi-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            @media (max-width: 900px) {
              .lm1-testi-grid { grid-template-columns: 1fr !important; }
            }
            @media (min-width: 601px) and (max-width: 900px) {
              .lm1-testi-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
          `}</style>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            MEDIA TYPES STRIP
            ═══════════════════════════════════════════════════════════════ */}
        <div
          ref={mediaStripRef}
          aria-label="Supported disc formats"
          style={{
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
            padding: "18px 32px",
            opacity: 0,
          }}
        >
          <div style={{
            maxWidth: 1200, margin: "0 auto",
            display: "flex", alignItems: "center",
            gap: 0, flexWrap: "wrap" as const,
          }}>
            <span style={{
              fontFamily: SORA, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.16em", textTransform: "uppercase" as const,
              color: C.textFaint, marginRight: 28, whiteSpace: "nowrap" as const,
            }}>
              Works with
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" as const }}>
              {["DVD", "DVD-R / DVD+R", "Data CD", "Audio CD", "CD-R / CD-RW", "Blu-ray", "Kodak Photo CD", "Burned discs"].map((label, i, arr) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center" }}>
                  <span style={{
                    fontFamily: SORA, fontSize: 12, fontWeight: 500,
                    color: label === "Kodak Photo CD" ? C.amber : C.textMuted,
                    letterSpacing: "0.01em",
                  }}>
                    {label}
                  </span>
                  {i < arr.length - 1 && (
                    <span aria-hidden style={{
                      display: "inline-block", width: 1, height: 11,
                      background: C.border, margin: "0 18px",
                    }} />
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            KODAK PHOTO CD CALLOUT — biggest untapped SEO niche
            ═══════════════════════════════════════════════════════════════ */}
        <section
          ref={photocdRef}
          id="kodak-photo-cd"
          aria-labelledby="photocd-heading"
          style={{
            padding: "0 32px",
            clipPath: "inset(0% 0% 100% 0%)",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 0" }}>
            <div style={{
              background: `linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 60%, ${C.pageAlt} 100%)`,
              border: `1px solid ${C.amberBorder}`,
              borderRadius: 20,
              padding: "clamp(40px, 5vw, 72px)",
              position: "relative" as const,
              overflow: "hidden",
            }}>
              {/* Background amber glow */}
              <div aria-hidden style={{
                position: "absolute", top: -80, right: -80,
                width: 400, height: 400, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

              <div className="lm1-photocd-grid">
                <div>
                  {/* Year badge */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "5px 12px", borderRadius: 100,
                    background: C.amberFaint, border: `1px solid ${C.amberBorder}`,
                    fontFamily: SORA, fontSize: 10, fontWeight: 700,
                    color: C.amber, letterSpacing: "0.14em",
                    textTransform: "uppercase" as const,
                    marginBottom: 24,
                  }}>
                    1990 – 2004 · Format discontinued
                  </div>

                  <h2
                    id="photocd-heading"
                    style={{
                      fontFamily: SORA, fontWeight: 700,
                      fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
                      lineHeight: 1.1, letterSpacing: "-0.03em",
                      color: C.text, marginBottom: 20,
                    }}
                  >
                    Your Kodak Photo CD{" "}
                    <span style={{ color: C.amber }}>still holds its memories.</span>
                  </h2>

                  <p style={{
                    fontFamily: SORA, fontSize: 16, color: C.textMuted,
                    lineHeight: 1.7, marginBottom: 16, maxWidth: 520,
                  }}>
                    From 1990 to 2004, photo labs digitised your film onto special Kodak Photo CDs — the gold standard for photo quality at the time. The files are in a proprietary .PCD format that Windows 10 and 11 can't open natively, and Adobe Photoshop dropped all support in 2023.
                  </p>

                  <p style={{
                    fontFamily: SORA, fontSize: 16, color: C.textMuted,
                    lineHeight: 1.7, marginBottom: 32, maxWidth: 520,
                  }}>
                    <strong style={{ color: C.text }}>Heirvo reads Kodak Photo CDs directly.</strong> It extracts your original high-resolution scans — up to 18 megapixels — and converts them to standard JPEG or TIFF files you can view, share, and print on any device.
                  </p>

                  {/* Key facts */}
                  <div style={{ display: "flex", gap: 32, flexWrap: "wrap" as const, marginBottom: 36 }}>
                    {[
                      { label: "Max resolution", value: "18 MP" },
                      { label: "Format", value: ".PCD → JPEG / TIFF" },
                      { label: "Windows 11", value: "Fully supported" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{
                          fontFamily: SORA, fontSize: 10, fontWeight: 700,
                          letterSpacing: "0.12em", textTransform: "uppercase" as const,
                          color: C.textFaint, marginBottom: 4,
                        }}>
                          {label}
                        </div>
                        <div style={{
                          fontFamily: SORA, fontSize: 14, fontWeight: 600,
                          color: C.amber, letterSpacing: "-0.01em",
                        }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, alignItems: "center" }}>
                    <a
                      href={DOWNLOAD_URL}
                      aria-label="Download Heirvo to open Kodak Photo CDs on Windows"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "13px 22px", borderRadius: 10,
                        background: C.amber, color: "#0B0800",
                        fontFamily: SORA, fontSize: 14, fontWeight: 700,
                        letterSpacing: "-0.01em", textDecoration: "none",
                        transition: "background 0.18s ease, box-shadow 0.18s ease",
                        boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
                        whiteSpace: "nowrap" as const,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = C.amberHover;
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(245,158,11,0.5)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = C.amber;
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(245,158,11,0.35)";
                      }}
                    >
                      Open my Kodak Photo CD
                    </a>
                    <Link
                      to="/recover"
                      style={{
                        fontFamily: SORA, fontSize: 13, fontWeight: 500,
                        color: C.amber, textDecoration: "none",
                        borderBottom: `1px solid ${C.amberBorder}`,
                        paddingBottom: 1,
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.75"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    >
                      Or send us your disc →
                    </Link>
                  </div>
                </div>

                {/* Right — visual representation */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <div style={{ position: "relative" as const, width: 240, height: 240 }}>
                    {/* Disc rings — amber for Photo CD */}
                    {[240, 196, 152, 108, 64].map((d, i) => (
                      <div key={d} aria-hidden style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: d, height: d, borderRadius: "50%",
                        border: `1px solid rgba(245,158,11,${0.06 + i * 0.05})`,
                        background: i === 4
                          ? "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)"
                          : "transparent",
                      }} />
                    ))}
                    {/* Kodak label text */}
                    <div aria-hidden style={{
                      position: "absolute", top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                    }}>
                      <div style={{
                        fontFamily: SORA, fontSize: 9, fontWeight: 700,
                        letterSpacing: "0.2em", textTransform: "uppercase" as const,
                        color: C.amber, opacity: 0.7,
                      }}>
                        Kodak
                      </div>
                      <div style={{
                        fontFamily: SORA, fontSize: 8, fontWeight: 600,
                        letterSpacing: "0.12em", textTransform: "uppercase" as const,
                        color: C.amberBorder,
                        marginTop: 2,
                      }}>
                        Photo CD
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <style>{`
                .lm1-photocd-grid {
                  display: grid;
                  grid-template-columns: 1fr auto;
                  gap: 48px;
                  align-items: center;
                }
                @media (max-width: 760px) {
                  .lm1-photocd-grid { grid-template-columns: 1fr !important; }
                  .lm1-photocd-grid > div:last-child { display: none; }
                }
              `}</style>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            TWO PATHS — DIY vs Mail-in, equal visual weight
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="paths-heading"
          style={{ padding: "80px 32px" }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <Eyebrow style={{ marginBottom: 16 }}>Choose your recovery path</Eyebrow>
            <h2
              id="paths-heading"
              style={{
                fontFamily: SORA, fontWeight: 700,
                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                lineHeight: 1.1, letterSpacing: "-0.03em",
                color: C.text, marginBottom: 48,
              }}
            >
              Two ways to rescue your memories.
            </h2>

            <div ref={pathsRef} className="lm1-paths-grid">
              {/* Path 1 — DIY */}
              <div
                className="path-card"
                style={{
                  background: C.pageAlt,
                  border: `1.5px solid ${C.blueBorder}`,
                  borderRadius: 16,
                  padding: "48px 40px 40px",
                  display: "flex", flexDirection: "column" as const,
                  gap: 0, position: "relative" as const,
                  opacity: 0,
                }}
              >
                <div style={{
                  position: "absolute" as const, top: -12, left: 28,
                  background: C.blue, color: "#FFFFFF",
                  fontFamily: SORA, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase" as const,
                  padding: "3px 12px", borderRadius: 100,
                }}>
                  Most popular
                </div>

                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: C.blueFaint, border: `1px solid ${C.blueBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 24,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke={C.blue} strokeWidth="1.8" />
                    <path d="M8 21h8M12 17v4" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>

                <Eyebrow style={{ marginBottom: 10, color: C.blue }}>Software — do it yourself</Eyebrow>
                <h3 style={{
                  fontFamily: SORA, fontWeight: 700,
                  fontSize: "clamp(1.3rem, 2vw, 1.7rem)",
                  lineHeight: 1.15, letterSpacing: "-0.025em",
                  color: C.text, marginBottom: 12,
                }}>
                  Download and recover at home
                </h3>
                <p style={{
                  fontFamily: SORA, fontSize: 15, color: C.textMuted,
                  lineHeight: 1.7, marginBottom: 28, flex: 1,
                }}>
                  Insert your disc, scan for free, and save your files with a single $39 payment. No subscription, no account, no tech expertise needed. Works offline on any Windows 10 or 11 PC.
                </p>

                <div style={{ marginBottom: 32 }}>
                  <div style={{
                    fontFamily: SORA, fontSize: 48, fontWeight: 700,
                    letterSpacing: "-0.045em", color: C.text, lineHeight: 1,
                    marginBottom: 4,
                  }}>
                    $0
                  </div>
                  <div style={{ fontFamily: SORA, fontSize: 13, color: C.textMuted }}>
                    to scan — <strong style={{ color: C.text }}>$39 one-time</strong> to save your files
                  </div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  {[
                    "Free full scan — see all recoverable files",
                    "Sector-by-sector deep read",
                    "Supports DVD, CD, Blu-ray, Kodak Photo CD",
                    "No subscription, ever",
                    "Works offline — your files stay private",
                  ].map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: SORA, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
                      <CheckIcon size={13} color={C.blue} />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={DOWNLOAD_URL}
                  aria-label="Download Heirvo free disc recovery software"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "14px 20px", borderRadius: 10,
                    background: C.blue, color: "#FFFFFF",
                    fontFamily: SORA, fontSize: 14, fontWeight: 700,
                    textDecoration: "none", letterSpacing: "-0.01em",
                    transition: "background 0.18s ease, box-shadow 0.18s ease",
                    boxShadow: "0 4px 20px rgba(10,132,255,0.3)",
                    marginTop: "auto",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.blueHover;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(10,132,255,0.45)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.blue;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(10,132,255,0.3)";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 3v13M6 11l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Download Free for Windows
                </a>
              </div>

              {/* Path 2 — Mail-in */}
              <div
                className="path-card"
                style={{
                  background: C.pageAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: "48px 40px 40px",
                  display: "flex", flexDirection: "column" as const,
                  gap: 0,
                  opacity: 0,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 24,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <Eyebrow style={{ marginBottom: 10 }}>Mail-in service — we do it for you</Eyebrow>
                <h3 style={{
                  fontFamily: SORA, fontWeight: 700,
                  fontSize: "clamp(1.3rem, 2vw, 1.7rem)",
                  lineHeight: 1.15, letterSpacing: "-0.025em",
                  color: C.text, marginBottom: 12,
                }}>
                  No drive? No computer? No problem.
                </h3>
                <p style={{
                  fontFamily: SORA, fontSize: 15, color: C.textMuted,
                  lineHeight: 1.7, marginBottom: 28, flex: 1,
                }}>
                  Ship your disc to our lab. Our team extracts your files using professional optical recovery equipment and delivers them via a secure cloud link, USB drive, or uploads directly to Google Photos or iCloud.
                </p>

                <div style={{ marginBottom: 32 }}>
                  <div style={{
                    fontFamily: SORA, fontSize: 48, fontWeight: 700,
                    letterSpacing: "-0.045em", color: C.text, lineHeight: 1,
                    marginBottom: 4,
                  }}>
                    from $89
                  </div>
                  <div style={{ fontFamily: SORA, fontSize: 13, color: C.textMuted }}>
                    No recovery, no charge — guaranteed
                  </div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  {[
                    "No-recovery / no-charge guarantee",
                    "Professional extraction equipment",
                    "Delivered in 10–14 days (rush: +$25)",
                    "Cloud link (free), USB (+$19), Google Photos / iCloud (+$15)",
                    "Fragile and rare discs welcome",
                  ].map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: SORA, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
                      <CheckIcon size={13} color={C.textFaint} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/recover"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "14px 20px", borderRadius: 10,
                    background: "transparent", color: C.text,
                    fontFamily: SORA, fontSize: 14, fontWeight: 600,
                    textDecoration: "none", letterSpacing: "-0.01em",
                    border: `1.5px solid ${C.borderMed}`,
                    transition: "border-color 0.18s ease, background 0.18s ease",
                    marginTop: "auto",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderBright;
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderMed;
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  Get started with mail-in
                  <ChevronRight size={13} color="currentColor" />
                </Link>
              </div>
            </div>

            <style>{`
              .lm1-paths-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
              }
              @media (max-width: 760px) {
                .lm1-paths-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
          </div>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            HOW IT WORKS — 3 steps + HowTo schema
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="how-heading"
          style={{ padding: "96px 32px" }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="lm1-how-grid">
              {/* Left: heading block */}
              <div>
                <Eyebrow style={{ marginBottom: 16 }}>How it works</Eyebrow>
                <h2
                  id="how-heading"
                  style={{
                    fontFamily: SORA, fontWeight: 700,
                    fontSize: "clamp(1.8rem, 3vw, 2.75rem)",
                    lineHeight: 1.1, letterSpacing: "-0.03em",
                    color: C.text, marginBottom: 20,
                  }}
                >
                  Three steps.<br />No expertise required.
                </h2>
                <p style={{
                  fontFamily: SORA, fontSize: 15, color: C.textMuted,
                  lineHeight: 1.7, maxWidth: 380, marginBottom: 40,
                }}>
                  Heirvo handles everything. You insert the disc and choose where to save. It does what a regular file copy can't — including trying passes that other software skips entirely.
                </p>

                {/* Big stat */}
                <div style={{
                  padding: "28px 32px",
                  background: C.pageAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  display: "inline-block",
                }}>
                  <div style={{
                    fontFamily: SORA, fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
                    fontWeight: 700, letterSpacing: "-0.05em",
                    color: C.blue, lineHeight: 1,
                    marginBottom: 6,
                  }}>
                    9×
                  </div>
                  <div style={{
                    fontFamily: SORA, fontSize: 12, color: C.textMuted,
                    letterSpacing: "0.01em", lineHeight: 1.5,
                  }}>
                    maximum retry passes<br />per damaged sector
                  </div>
                </div>
              </div>

              {/* Right: steps */}
              <div ref={stepsRef} style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
                {[
                  {
                    n: "01",
                    title: "Insert your disc",
                    body: "Connect any USB or internal disc drive to your Windows 10 or 11 PC and insert your DVD, CD, or Blu-ray. Heirvo detects the disc format automatically. No settings to configure — just open the app and go.",
                  },
                  {
                    n: "02",
                    title: "Run the free scan",
                    body: "Click Scan. Heirvo reads every sector using low-level SCSI pass-through commands — the same technique professional data recovery labs use. It retries each failing sector up to nine times, at full speed and half speed, forward and in reverse.",
                  },
                  {
                    n: "03",
                    title: "Preview, then save",
                    body: "The scan is completely free. You see every recoverable file before spending anything. When you're ready, pay $39 once to unlock saving. Extract files individually, save a full ISO image, or let Heirvo convert video to MP4 automatically.",
                  },
                ].map(({ n, title, body }, i) => (
                  <React.Fragment key={n}>
                    <div
                      className="step-item"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px 1fr",
                        gap: "0 24px",
                        alignItems: "start",
                        padding: "36px 0",
                        opacity: 0,
                      }}
                    >
                      <div style={{
                        fontFamily: SORA, fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
                        fontWeight: 700, letterSpacing: "-0.05em",
                        color: C.border, lineHeight: 1,
                        userSelect: "none",
                      }} aria-hidden>
                        {n}
                      </div>
                      <div style={{ paddingTop: 8 }}>
                        <h3 style={{
                          fontFamily: SORA, fontSize: 17, fontWeight: 700,
                          color: C.text, lineHeight: 1.25,
                          letterSpacing: "-0.02em", marginBottom: 10,
                        }}>
                          {title}
                        </h3>
                        <p style={{
                          fontFamily: SORA, fontSize: 14, color: C.textMuted,
                          lineHeight: 1.7, margin: 0,
                        }}>
                          {body}
                        </p>
                      </div>
                    </div>
                    {i < 2 && <Rule />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <style>{`
              .lm1-how-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 80px;
                align-items: start;
              }
              @media (max-width: 860px) {
                .lm1-how-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
              }
            `}</style>
          </div>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            PRICING — 3 tiers
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          style={{ padding: "96px 32px" }}
        >
          <div ref={pricingRef} style={{ maxWidth: 1200, margin: "0 auto" }}>
            <Eyebrow style={{ marginBottom: 16 }}>Simple pricing</Eyebrow>
            <h2
              id="pricing-heading"
              style={{
                fontFamily: SORA, fontWeight: 700,
                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                lineHeight: 1.1, letterSpacing: "-0.03em",
                color: C.text, marginBottom: 16,
              }}
            >
              Pay only when you succeed.
            </h2>
            <p style={{
              fontFamily: SORA, fontSize: 16, color: C.textMuted,
              lineHeight: 1.7, marginBottom: 56, maxWidth: 500,
            }}>
              The scan is always free. You see exactly what's recoverable before any payment. No subscription, no account, no surprises.
            </p>

            <div className="lm1-pricing-grid">
              {/* Tier 1 — Free scan */}
              <div
                className="pricing-card"
                style={{
                  background: C.pageAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: "36px 32px",
                  display: "flex", flexDirection: "column" as const,
                  opacity: 0,
                }}
              >
                <Eyebrow style={{ marginBottom: 16 }}>Free scan</Eyebrow>
                <div style={{
                  fontFamily: SORA, fontSize: 44, fontWeight: 700,
                  letterSpacing: "-0.045em", color: C.text,
                  lineHeight: 1, marginBottom: 4,
                }}>
                  $0
                </div>
                <div style={{ fontFamily: SORA, fontSize: 13, color: C.textMuted, marginBottom: 28 }}>
                  no time limit · no account required
                </div>
                <Rule style={{ marginBottom: 24 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 10, flex: 1 }}>
                  {[
                    "Full sector-by-sector scan",
                    "Preview every recoverable file",
                    "See filenames and sizes",
                    "Works on all supported disc types",
                  ].map((f) => (
                    <li key={f} style={{ display: "flex", gap: 10, fontFamily: SORA, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
                      <CheckIcon size={13} color={C.textFaint} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={DOWNLOAD_URL}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "12px 18px", borderRadius: 8,
                    border: `1.5px solid ${C.borderMed}`, background: "transparent",
                    color: C.text, fontFamily: SORA, fontSize: 13, fontWeight: 600,
                    textDecoration: "none", letterSpacing: "-0.01em",
                    transition: "border-color 0.18s, background 0.18s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderBright;
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderMed;
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  Download &amp; Scan Free
                </a>
              </div>

              {/* Tier 2 — Pro $39 */}
              <div
                className="pricing-card"
                style={{
                  background: C.pageAlt,
                  border: `1.5px solid ${C.blue}`,
                  borderRadius: 16,
                  padding: "36px 32px",
                  display: "flex", flexDirection: "column" as const,
                  position: "relative" as const,
                  boxShadow: "0 0 0 4px rgba(10,132,255,0.07)",
                  opacity: 0,
                }}
              >
                <span style={{
                  position: "absolute" as const, top: -13, left: 24,
                  background: C.blue, color: "#FFF",
                  fontFamily: SORA, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase" as const,
                  padding: "4px 12px", borderRadius: 100,
                }}>
                  Most popular
                </span>
                <Eyebrow style={{ marginBottom: 16, color: C.blue }}>Pro — one-time payment</Eyebrow>
                <div style={{
                  fontFamily: SORA, fontSize: 44, fontWeight: 700,
                  letterSpacing: "-0.045em", color: C.text,
                  lineHeight: 1, marginBottom: 4,
                }}>
                  $39
                </div>
                <div style={{ fontFamily: SORA, fontSize: 13, color: C.textMuted, marginBottom: 28 }}>
                  one-time · no subscription · unlimited discs
                </div>
                <Rule style={{ marginBottom: 24 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 10, flex: 1 }}>
                  {[
                    "Everything in the free scan",
                    "Save all recovered files",
                    "Extract MP4, ISO, or raw files",
                    "Kodak Photo CD .PCD → JPEG / TIFF",
                    "Unlimited discs, lifetime licence",
                    "No account, works fully offline",
                  ].map((f) => (
                    <li key={f} style={{ display: "flex", gap: 10, fontFamily: SORA, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
                      <CheckIcon size={13} color={C.blue} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={DOWNLOAD_URL}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "14px 18px", borderRadius: 8,
                    background: C.blue, color: "#FFF",
                    fontFamily: SORA, fontSize: 14, fontWeight: 700,
                    textDecoration: "none", letterSpacing: "-0.01em",
                    transition: "background 0.18s, box-shadow 0.18s",
                    boxShadow: "0 4px 20px rgba(10,132,255,0.3)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.blueHover;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(10,132,255,0.45)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.blue;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(10,132,255,0.3)";
                  }}
                >
                  Download Free · Unlock for $39
                </a>
              </div>

              {/* Tier 3 — Mail-in */}
              <div
                className="pricing-card"
                style={{
                  background: C.pageAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: "36px 32px",
                  display: "flex", flexDirection: "column" as const,
                  opacity: 0,
                }}
              >
                <Eyebrow style={{ marginBottom: 16 }}>Mail-in service</Eyebrow>
                <div style={{
                  fontFamily: SORA, fontSize: 44, fontWeight: 700,
                  letterSpacing: "-0.045em", color: C.text,
                  lineHeight: 1, marginBottom: 4,
                }}>
                  from $89
                </div>
                <div style={{ fontFamily: SORA, fontSize: 13, color: C.textMuted, marginBottom: 28 }}>
                  per disc · no-recovery, no-charge guaranteed
                </div>
                <Rule style={{ marginBottom: 24 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 10, flex: 1 }}>
                  {[
                    "No computer or drive needed",
                    "Professional lab equipment",
                    "Delivered in 10–14 days",
                    "Rush processing: +$25",
                    "Cloud link · USB +$19 · G Photos/iCloud +$15",
                    "Fragile, rare discs welcome",
                  ].map((f) => (
                    <li key={f} style={{ display: "flex", gap: 10, fontFamily: SORA, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
                      <CheckIcon size={13} color={C.textFaint} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/recover"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "13px 18px", borderRadius: 8,
                    border: `1.5px solid ${C.borderMed}`, background: "transparent",
                    color: C.text, fontFamily: SORA, fontSize: 13, fontWeight: 600,
                    textDecoration: "none", letterSpacing: "-0.01em",
                    transition: "border-color 0.18s, background 0.18s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderBright;
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderMed;
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  Start mail-in recovery
                  <ChevronRight size={12} color="currentColor" />
                </Link>
              </div>
            </div>

            <style>{`
              .lm1-pricing-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
              }
              @media (max-width: 960px) {
                .lm1-pricing-grid { grid-template-columns: 1fr 1fr !important; }
              }
              @media (max-width: 640px) {
                .lm1-pricing-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
          </div>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            FAQ — min 7 questions, optimised for People Also Ask + AIO
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="faq-heading"
          style={{ padding: "96px 32px" }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="lm1-faq-grid">
              {/* Left: sticky label */}
              <div>
                <Eyebrow style={{ marginBottom: 16 }}>Frequently asked questions</Eyebrow>
                <h2
                  id="faq-heading"
                  style={{
                    fontFamily: SORA, fontWeight: 700,
                    fontSize: "clamp(1.6rem, 2.5vw, 2.25rem)",
                    lineHeight: 1.15, letterSpacing: "-0.03em",
                    color: C.text, marginBottom: 20,
                  }}
                >
                  Everything you need to know.
                </h2>
                <p style={{
                  fontFamily: SORA, fontSize: 15, color: C.textMuted,
                  lineHeight: 1.7, maxWidth: 280, marginBottom: 32,
                }}>
                  Still have a question? Email us at{" "}
                  <a
                    href="mailto:hello@heirvo.com"
                    style={{ color: C.blue, textDecoration: "none" }}
                  >
                    hello@heirvo.com
                  </a>
                  {" "}— a human replies within one business day.
                </p>
              </div>

              {/* Right: FAQ items */}
              <div ref={faqRef}>
                {[
                  {
                    q: "Can I recover files from a scratched DVD?",
                    a: "Yes. Heirvo is DVD recovery software built specifically for scratched and damaged discs. It reads each sector multiple times at different speeds — forward and backward — to recover data that a standard file copy misses entirely. The free scan shows exactly what is recoverable before you pay anything.",
                  },
                  {
                    q: "What is the best software to recover files from a damaged CD or DVD in 2025?",
                    a: "Heirvo is a purpose-built disc recovery tool for Windows 10 and 11. Unlike older tools such as IsoBuster or CDRoller — which are powerful but aimed at technical users — Heirvo is designed for everyday people recovering family photos and home videos. The scan is free; saving files costs a one-time $39 with no subscription.",
                  },
                  {
                    q: "How do I open Kodak Photo CD files on Windows 10 or 11?",
                    a: "Kodak Photo CDs use the .PCD format. Windows 10 and 11 cannot open .PCD files natively, and Adobe Photoshop dropped all support in 2023. Heirvo reads Kodak Photo CDs directly, extracts the full-resolution images — up to 18 megapixels — and converts them to standard JPEG or TIFF files you can view on any device.",
                  },
                  {
                    q: "Is there a free DVD recovery tool for Windows?",
                    a: "Heirvo offers a completely free scan. You can see every recoverable file on your disc — names, sizes, and types — before spending anything. If you want to save those files, a one-time payment of $39 unlocks unlimited saves. There is no subscription, no account required, and no recurring fee.",
                  },
                  {
                    q: "What disc types does Heirvo support?",
                    a: "Heirvo supports DVD, DVD-R, DVD+R, DVD-RW, DVD+RW, Data CD, Audio CD, CD-R, CD-RW, Blu-ray, BD-R, Kodak Photo CD (.PCD), and standard burned discs. It works with any USB or internal disc drive on a Windows 10 or 11 PC (64-bit only).",
                  },
                  {
                    q: "What if I don't have a disc drive, or the disc is too badly damaged for software to read?",
                    a: "Heirvo offers a mail-in recovery service from $89 per disc. You post your disc to the lab, and the team uses professional optical extraction equipment to recover your files. If nothing can be recovered, you pay nothing. Files are delivered via secure cloud link within 10–14 days, with rush processing available for an additional $25.",
                  },
                  {
                    q: "Will Windows SmartScreen warn me about Heirvo?",
                    a: "Windows SmartScreen may show a warning when you first run Heirvo because the software is new and does not yet have a large install history. This is a standard caution for any newly released application — not an indication of malware. Click 'More info' then 'Run anyway' to continue. Heirvo contains no malware, adware, or tracking software of any kind.",
                  },
                ].map(({ q, a }) => (
                  <FaqItem key={q} question={q} answer={a} />
                ))}
              </div>
            </div>

            <style>{`
              .lm1-faq-grid {
                display: grid;
                grid-template-columns: 280px 1fr;
                gap: 64px;
                align-items: start;
              }
              @media (max-width: 860px) {
                .lm1-faq-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
              }
            `}</style>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            FINAL CTA
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="final-cta-heading"
          style={{ padding: "0 32px 120px" }}
        >
          <div
            ref={finalCtaRef}
            style={{ maxWidth: 1200, margin: "0 auto" }}
          >
            <div style={{
              background: `linear-gradient(135deg, ${C.pageMid} 0%, ${C.pageAlt} 100%)`,
              border: `1px solid ${C.borderMed}`,
              borderRadius: 20,
              padding: "clamp(48px, 6vw, 88px)",
              position: "relative" as const,
              overflow: "hidden",
              textAlign: "center",
            }}>
              {/* Background glows */}
              <div aria-hidden style={{
                position: "absolute", top: -100, left: "50%",
                transform: "translateX(-50%)",
                width: 600, height: 300,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(10,132,255,0.10) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

              <h2
                id="final-cta-heading"
                style={{
                  fontFamily: SORA, fontWeight: 700,
                  fontSize: "clamp(2rem, 4vw, 3.25rem)",
                  lineHeight: 1.1, letterSpacing: "-0.035em",
                  color: C.text, marginBottom: 20,
                  position: "relative" as const,
                }}
              >
                The memories are still there.
                <br />
                <span style={{ color: C.blue }}>Let's get them back.</span>
              </h2>

              <p style={{
                fontFamily: SORA, fontSize: 17, color: C.textMuted,
                lineHeight: 1.7, maxWidth: 500, margin: "0 auto 40px",
                position: "relative" as const,
              }}>
                Scan your disc for free right now. No account needed. See exactly what's recoverable — then decide.
              </p>

              <div
                className="cta-actions"
                style={{
                  display: "flex", gap: 14, justifyContent: "center",
                  flexWrap: "wrap" as const, alignItems: "center",
                  position: "relative" as const,
                  opacity: 0,
                }}
              >
                <a
                  href={DOWNLOAD_URL}
                  aria-label="Download Heirvo DVD recovery software free for Windows"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    padding: "16px 32px", borderRadius: 12,
                    background: C.blue, color: "#FFFFFF",
                    fontFamily: SORA, fontSize: 15, fontWeight: 700,
                    letterSpacing: "-0.01em", textDecoration: "none",
                    transition: "background 0.18s, box-shadow 0.18s",
                    boxShadow: "0 6px 32px rgba(10,132,255,0.40)",
                    whiteSpace: "nowrap" as const,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.blueHover;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(10,132,255,0.55)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.blue;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 32px rgba(10,132,255,0.40)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 3v13M6 11l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Download Free for Windows
                </a>

                <Link
                  to="/recover"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "15px 24px", borderRadius: 12,
                    background: "transparent", color: C.textMuted,
                    fontFamily: SORA, fontSize: 14, fontWeight: 500,
                    textDecoration: "none", letterSpacing: "-0.01em",
                    border: `1.5px solid ${C.borderMed}`,
                    transition: "color 0.18s, border-color 0.18s",
                    whiteSpace: "nowrap" as const,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = C.text;
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderBright;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = C.textMuted;
                    (e.currentTarget as HTMLElement).style.borderColor = C.borderMed;
                  }}
                >
                  Or mail us your disc
                  <ChevronRight size={13} color="currentColor" />
                </Link>
              </div>

              {/* Urgency note */}
              <p style={{
                fontFamily: SORA, fontSize: 12, color: C.textFaint,
                marginTop: 24, position: "relative" as const,
              }}>
                Optical disc dye degrades over time. The longer you wait, the harder recovery becomes.
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />

      {/* ── Global styles ─────────────────────────────────────────────── */}
      <style>{`
        .lm1-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px;
        }
        body:has(.lm1-root) {
          background: #0B1220 !important;
        }
        @media (max-width: 640px) {
          .lm1-container { padding: 0 16px; }
          .lm1-hero { padding: 80px 0 48px !important; }
        }
      `}</style>
    </div>
  );
}

// ─── FAQ accordion item ───────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <article
      className="faq-item"
      itemScope
      itemType="https://schema.org/Question"
      style={{
        borderBottom: `1px solid ${C.border}`,
        opacity: 0,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%", textAlign: "left" as const,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, padding: "24px 0",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: SORA, fontSize: 15, fontWeight: 600,
          color: C.text, lineHeight: 1.45,
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text; }}
      >
        <span itemProp="name">{question}</span>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 20, height: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: 2,
            transition: "transform 0.25s ease",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke={C.textFaint} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          itemScope
          itemType="https://schema.org/Answer"
          style={{ paddingBottom: 24 }}
        >
          <p
            itemProp="text"
            style={{
              fontFamily: SORA, fontSize: 14, color: C.textMuted,
              lineHeight: 1.75, margin: 0, maxWidth: 640,
            }}
          >
            {answer}
          </p>
        </div>
      )}
    </article>
  );
}
