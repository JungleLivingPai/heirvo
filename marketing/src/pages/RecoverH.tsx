import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import {
  staggerReveal,
  magneticHover,
  splitReveal,
} from "../lib/gsap-fx";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

/* ─────────────────────────────────────────────────────────────────────────────
 * RecoverH — Mail-in disc recovery service page
 * Editorial Dark to match LandingMin1. Higher-intent audience: people who
 * can't or won't DIY. Primary goal: get them to fill out the order form.
 * SEO: mail-in DVD recovery service, send disc for recovery, no drive recovery
 * ───────────────────────────────────────────────────────────────────────────── */

const FORMSPREE_ENDPOINT = `https://formspree.io/f/${
  (import.meta.env.VITE_FORMSPREE_ID as string) || "YOUR_FORM_ID"
}`;
const HAS_FORMSPREE = !!(import.meta.env.VITE_FORMSPREE_ID as string);
const STRIPE_INTAKE_URL: string =
  (import.meta.env.VITE_STRIPE_INTAKE_URL as string) ||
  "https://buy.stripe.com/test_8x23cn66W4i22jc3dGdEs00";

// ─── Design tokens — identical to LandingMin1 ──────────────────────────────

const C = {
  page:         "#0B1220",
  pageAlt:      "#0E1628",
  pageMid:      "#111827",
  text:         "#F0EDE8",
  textMuted:    "#94A3B8",
  textFaint:    "#5E7290",
  border:       "rgba(255,255,255,0.08)",
  borderMed:    "rgba(255,255,255,0.12)",
  borderBright: "rgba(255,255,255,0.20)",
  blue:         "#0A84FF",
  blueHover:    "#3B9EFF",
  blueFaint:    "rgba(10,132,255,0.12)",
  blueBorder:   "rgba(10,132,255,0.30)",
  amber:        "#F59E0B",
  amberFaint:   "rgba(245,158,11,0.10)",
  amberBorder:  "rgba(245,158,11,0.25)",
  green:        "#34C759",
  greenFaint:   "rgba(52,199,89,0.12)",
  greenBorder:  "rgba(52,199,89,0.30)",
  grain:        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
} as const;

const SORA = '"Sora", ui-sans-serif, system-ui, sans-serif';

// ─── Structured data ────────────────────────────────────────────────────────

const FAQ_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I send my disc in for recovery?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Fill out the order form and pay the $19.99 intake fee. We then email you our closest regional address and packaging instructions. Any padded bubble mailer works — put the disc in its case or a paper sleeve, seal it, and mail it to us via any trackable carrier."
      }
    },
    {
      "@type": "Question",
      "name": "What if you can't recover anything from my disc?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You pay nothing for that disc. The $19.99 intake fee covers our processing and return shipping and is always retained. The per-disc recovery charge is waived entirely if we cannot extract files. Your original disc is always returned regardless of outcome."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need a DVD drive or special equipment?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. The mail-in service requires nothing on your end — no disc drive, no software, no technical knowledge. You mail the disc, we do the recovery on professional optical equipment, and you receive your files via cloud link, USB drive, or direct upload to Google Photos or iCloud."
      }
    },
    {
      "@type": "Question",
      "name": "How long does the mail-in recovery service take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "10 to 14 business days from when we receive your disc. Rush processing (5 business days) is available for an additional $25. We email a confirmation photo when your disc arrives and another when your files are ready."
      }
    },
    {
      "@type": "Question",
      "name": "Will my original disc come back?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, always. Every order includes return shipping of the original disc regardless of the recovery outcome. We use USPS Flat Rate with tracking."
      }
    },
    {
      "@type": "Question",
      "name": "Can you recover a Kodak Photo CD?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Kodak Photo CDs use the .PCD format that Windows 10 and 11 can no longer open. We read the disc on professional equipment, extract the full-resolution scans — up to 18 megapixels — and deliver them as standard JPEG or TIFF files."
      }
    }
  ]
});

const HOWTO_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to use the Heirvo mail-in DVD recovery service",
  "description": "Send your damaged DVD, CD, or Kodak Photo CD to Heirvo's lab for professional recovery. No equipment needed. No recovery, no charge.",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Place your order",
      "text": "Fill out the order form on heirvo.com/recover. Select your disc types, quantity, and delivery preference. Pay the $19.99 intake fee to confirm your order."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Mail your disc",
      "text": "We email you the nearest regional address and packaging instructions. Place your disc in a padded bubble mailer and ship via any trackable carrier (USPS, UPS, FedEx)."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Receive your files",
      "text": "Within 10–14 business days, we email you a secure cloud download link. Files can also be delivered on USB drive or uploaded directly to Google Photos or iCloud."
    }
  ]
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcPrice(qty: number): number {
  if (qty <= 0) return 0;
  if (qty === 1) return 89;
  if (qty === 2) return 178;
  if (qty === 3) return 237;
  if (qty === 4) return 316;
  if (qty <= 9) return qty * 72;
  if (qty <= 19) return qty * 65;
  return qty * 59;
}

function returnShipping(qty: number): number {
  if (qty <= 5)  return 10;
  if (qty <= 12) return 17;
  if (qty <= 20) return 24;
  return 45;
}

function priceLabel(qty: number, addOns: number): string {
  const base = calcPrice(qty) + 19.99 + returnShipping(qty) + addOns;
  return `$${base.toFixed(2)}`;
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontFamily: SORA, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.18em", textTransform: "uppercase" as const,
      color: C.textFaint, ...style,
    }}>
      {children}
    </div>
  );
}

function Rule({ style }: { style?: React.CSSProperties }) {
  return <div aria-hidden style={{ height: 1, background: C.border, width: "100%", ...style }} />;
}

function CheckIcon({ color = C.blue, size = 13 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <article className="faq-item" itemScope itemType="https://schema.org/Question"
      style={{ borderBottom: `1px solid ${C.border}`, opacity: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%", textAlign: "left" as const,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, padding: "22px 0",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: SORA, fontSize: 15, fontWeight: 600,
          color: C.text, lineHeight: 1.45, letterSpacing: "-0.01em",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text; }}
      >
        <span itemProp="name">{question}</span>
        <span aria-hidden style={{
          flexShrink: 0, width: 20, height: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 2, transition: "transform 0.25s ease",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke={C.textFaint} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div itemScope itemType="https://schema.org/Answer" style={{ paddingBottom: 22 }}>
          <p itemProp="text" style={{
            fontFamily: SORA, fontSize: 14, color: C.textMuted,
            lineHeight: 1.75, margin: 0, maxWidth: 620,
          }}>
            {answer}
          </p>
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RecoverH() {
  // ── Form state ───────────────────────────────────────────────────────────────
  const [discTypes, setDiscTypes] = useState<string[]>([]);
  const [discQty,   setDiscQty]   = useState<number>(1);
  const [delivery,  setDelivery]  = useState<"cloud" | "usb" | "upload">("cloud");
  const [rush,      setRush]      = useState(false);
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [address,   setAddress]   = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy,      setBusy]      = useState(false);

  const addOnCost =
    (delivery === "usb" ? 19 : delivery === "upload" ? 15 : 0) +
    (rush ? 25 : 0);

  const toggleDiscType = (type: string) => {
    setDiscTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          disc_types:      discTypes.join(", ") || "Not specified",
          disc_quantity:   discQty,
          delivery_option: delivery === "cloud" ? "Cloud download (free)" : delivery === "usb" ? "USB drive (+$19)" : "Google Photos / iCloud (+$15)",
          rush_processing: rush ? "Yes (+$25)" : "No",
          name, email,
          phone:           phone || "(not provided)",
          return_address:  address,
          notes:           notes || "(none)",
          estimated_total: priceLabel(discQty, addOnCost),
        }),
      });
      if (res.ok) setSubmitted(true);
      else alert("Something went wrong — please email hello@heirvo.com directly.");
    } finally {
      setBusy(false);
    }
  };

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const rootRef       = useRef<HTMLDivElement>(null);
  const heroHeadRef   = useRef<HTMLHeadingElement>(null);
  const heroSubRef    = useRef<HTMLParagraphElement>(null);
  const heroCTAsRef   = useRef<HTMLDivElement>(null);
  const testiRef      = useRef<HTMLDivElement>(null);
  const stepsRef      = useRef<HTMLDivElement>(null);
  const pricingRef    = useRef<HTMLDivElement>(null);
  const faqRef        = useRef<HTMLDivElement>(null);
  const ctaBtnRef     = useRef<HTMLAnchorElement>(null);
  const submitBtnRef  = useRef<HTMLButtonElement>(null);

  // ── GSAP + meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const schemas = [FAQ_SCHEMA, HOWTO_SCHEMA];
    const scriptEls = schemas.map((schema) => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.textContent = schema;
      document.head.appendChild(el);
      return el;
    });

    const prevTitle = document.title;
    document.title = "Heirvo Mail-In Recovery — We Recover Your Disc For You | No Equipment Needed";
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = metaDesc?.content ?? "";
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      "Professional mail-in disc recovery service. Send us your damaged DVD, CD, Blu-ray, or Kodak Photo CD — no computer or drive needed. No recovery, no charge. Files back in 10–14 days.";

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      CustomEase.create("editorial", "M0,0 C0.22,1 0.36,1 1,1");

      if (reduce) {
        gsap.set(".testi-card, .step-item, .price-row, .faq-item, .disc-type-chip", {
          opacity: 1, clearProps: "transform",
        });
        return;
      }

      // Hero
      const heroTl = gsap.timeline({ defaults: { ease: "editorial" } });
      if (heroHeadRef.current) {
        try {
          const split = new SplitText(heroHeadRef.current, { type: "lines" });
          gsap.set(split.lines, { overflow: "hidden", clipPath: "inset(0% 0% 100% 0%)" });
          heroTl.to(split.lines, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, stagger: 0.11, delay: 0.15 });
        } catch {
          gsap.set(heroHeadRef.current, { opacity: 1 });
        }
      }
      if (heroSubRef.current) {
        heroTl.fromTo(heroSubRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, "-=0.55");
      }
      if (heroCTAsRef.current) {
        heroTl.fromTo(heroCTAsRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65 }, "-=0.45");
      }

      // Testimonials
      if (testiRef.current) {
        staggerReveal(testiRef.current, ".testi-card", { y: 32, stagger: 0.1, duration: 0.85 });
      }

      // Steps
      if (stepsRef.current) {
        staggerReveal(stepsRef.current, ".step-item", { y: 28, stagger: 0.1, duration: 0.8 });
      }

      // Pricing rows
      if (pricingRef.current) {
        staggerReveal(pricingRef.current, ".price-row", { y: 20, stagger: 0.06, duration: 0.7 });
      }

      // FAQ
      if (faqRef.current) {
        staggerReveal(faqRef.current, ".faq-item", { y: 20, stagger: 0.07, duration: 0.7 });
      }

      // Hero CTA form scroll button
      const cleanMagnetic1 = magneticHover(ctaBtnRef.current, 0.2);
      const cleanMagnetic2 = magneticHover(submitBtnRef.current, 0.2);

      return () => {
        cleanMagnetic1();
        cleanMagnetic2();
      };
    }, rootRef);

    return () => {
      ctx.revert();
      document.title = prevTitle;
      if (metaDesc) metaDesc.content = prevDesc;
      scriptEls.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, []);

  // ── Form field base styles ────────────────────────────────────────────────────
  const fieldBase: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${C.borderMed}`,
    padding: "12px 14px", fontSize: 14,
    color: C.text, fontFamily: SORA,
    outline: "none", borderRadius: 8,
    transition: "border-color 180ms",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: SORA, fontSize: 10,
    letterSpacing: "0.14em", textTransform: "uppercase" as const,
    color: C.textFaint, display: "block", marginBottom: 6, fontWeight: 700,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      className="rh-root"
      style={{ background: C.page, color: C.text, fontFamily: SORA, overflowX: "hidden", position: "relative" }}
    >
      {/* Film grain */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999,
        backgroundImage: C.grain, backgroundSize: "200px 200px",
        opacity: 0.35, mixBlendMode: "overlay",
      }} />

      <Nav />

      <main>

        {/* ═══════════════════════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="hero-heading"
          style={{
            minHeight: "88vh", display: "flex", alignItems: "center",
            padding: "100px 0 60px", position: "relative", overflow: "hidden",
          }}
        >
          {/* Ambient glows */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 60% 70% at 10% 50%, rgba(10,132,255,0.07) 0%, transparent 65%)",
          }} />
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 50% 50% at 90% 30%, rgba(52,199,89,0.04) 0%, transparent 60%)",
          }} />
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }} />

          <div className="rh-container rh-hero-grid">
            {/* Left */}
            <div style={{ maxWidth: 600 }}>
              <Eyebrow style={{ marginBottom: 24 }}>
                Mail-in recovery service · No equipment needed
              </Eyebrow>

              <h1
                id="hero-heading"
                ref={heroHeadRef}
                style={{
                  fontFamily: SORA, fontWeight: 700,
                  fontSize: "clamp(2.6rem, 5.5vw, 4.25rem)",
                  lineHeight: 1.06, letterSpacing: "-0.035em",
                  color: C.text, marginBottom: 28,
                }}
              >
                We recover your disc.{" "}
                <em style={{ fontStyle: "normal", color: C.blue }}>You get your memories back.</em>
              </h1>

              <p
                ref={heroSubRef}
                style={{
                  fontFamily: SORA, fontSize: "clamp(15px, 1.8vw, 18px)",
                  color: C.textMuted, lineHeight: 1.7,
                  marginBottom: 44, maxWidth: 480, opacity: 0,
                }}
              >
                No disc drive. No software. No technical knowledge required.
                Mail us your DVD, photo CD, or Blu-ray — our lab reads it on
                professional optical equipment and delivers your files within 10–14 days.
                If we can't recover anything,{" "}
                <strong style={{ color: C.text }}>you pay nothing.</strong>
              </p>

              <div ref={heroCTAsRef} style={{ opacity: 0 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, alignItems: "center", marginBottom: 20 }}>
                  <a
                    ref={ctaBtnRef}
                    href="#order-form"
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
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Start my recovery
                  </a>
                  <Link
                    to="/"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "14px 20px", borderRadius: 10,
                      background: "transparent", color: C.textMuted,
                      fontFamily: SORA, fontSize: 13, fontWeight: 500,
                      letterSpacing: "-0.01em", textDecoration: "none",
                      border: `1.5px solid ${C.borderMed}`,
                      transition: "border-color 0.18s ease, color 0.18s ease",
                      whiteSpace: "nowrap" as const,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = C.borderBright;
                      (e.currentTarget as HTMLElement).style.color = C.text;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = C.borderMed;
                      (e.currentTarget as HTMLElement).style.color = C.textMuted;
                    }}
                  >
                    Have a drive? Try the free software →
                  </Link>
                </div>

                {/* Trust signals */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
                  {[
                    "No recovery, no charge",
                    "Disc always returned",
                    "10–14 day turnaround",
                    "from $89 per disc",
                  ].map((tag) => (
                    <span key={tag} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: SORA, fontSize: 11, color: C.textFaint,
                    }}>
                      <CheckIcon size={10} color={C.green} />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — CSS envelope + disc illustration */}
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              position: "relative",
            }}>
              <div aria-hidden style={{
                position: "absolute", width: 380, height: 380, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(10,132,255,0.12) 0%, rgba(10,132,255,0.03) 50%, transparent 70%)",
                filter: "blur(40px)",
              }} />

              {/* Illustration */}
              <div style={{ position: "relative" as const, width: 340, height: 340 }}>
                {/* Envelope body */}
                <div aria-label="Illustration: disc going into an envelope" role="img" style={{
                  position: "absolute", bottom: 60, left: "50%",
                  transform: "translateX(-50%)",
                  width: 220, height: 155,
                  background: C.pageAlt,
                  border: `1px solid ${C.borderMed}`,
                  borderRadius: 10,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                }}>
                  {/* Envelope flap lines */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    height: 0, borderLeft: "110px solid transparent",
                    borderRight: "110px solid transparent",
                    borderTop: `60px solid ${C.pageMid}`,
                    borderRadius: "10px 10px 0 0",
                  }} />
                  {/* Envelope V */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    height: 0, borderLeft: "110px solid transparent",
                    borderRight: "110px solid transparent",
                    borderBottom: `48px solid ${C.border}`,
                  }} />
                  {/* Label */}
                  <div style={{
                    position: "absolute", bottom: 28, left: "50%",
                    transform: "translateX(-50%)",
                    fontFamily: SORA, fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.16em", textTransform: "uppercase" as const,
                    color: C.textFaint,
                    whiteSpace: "nowrap" as const,
                  }}>
                    Heirvo Recovery Lab
                  </div>
                </div>

                {/* Disc floating above envelope */}
                <div style={{
                  position: "absolute", top: 20, left: "50%",
                  transform: "translateX(-50%)",
                  width: 120, height: 120,
                }}>
                  {[120, 96, 72, 48, 24].map((d, i) => (
                    <div key={d} aria-hidden style={{
                      position: "absolute", top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: d, height: d, borderRadius: "50%",
                      border: `1px solid rgba(10,132,255,${0.08 + i * 0.06})`,
                      background: i === 4
                        ? "radial-gradient(circle, rgba(10,132,255,0.22) 0%, transparent 70%)"
                        : "transparent",
                    }} />
                  ))}
                  {/* Disc hub */}
                  <div aria-hidden style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 16, height: 16, borderRadius: "50%",
                    background: C.pageMid,
                    border: `1px solid ${C.borderMed}`,
                    boxShadow: "0 0 0 3px rgba(10,132,255,0.12)",
                  }} />
                </div>

                {/* Arrow pointing down toward envelope */}
                <div aria-hidden style={{
                  position: "absolute", top: 148, left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex", flexDirection: "column" as const,
                  alignItems: "center", gap: 4,
                }}>
                  <div style={{ width: 1, height: 32, background: `rgba(10,132,255,0.35)` }} />
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                    <path d="M1 1l5 6 5-6" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Status chip */}
                <div aria-hidden style={{
                  position: "absolute", top: 40, right: 20,
                  background: C.pageMid,
                  border: `1px solid ${C.greenBorder}`,
                  borderRadius: 8, padding: "8px 12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  minWidth: 130,
                }}>
                  <div style={{
                    fontFamily: SORA, fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase" as const,
                    color: C.green, marginBottom: 3,
                  }}>
                    Recovery complete
                  </div>
                  <div style={{ fontFamily: SORA, fontSize: 12, fontWeight: 600, color: C.text }}>
                    2,847 files ready
                  </div>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            .rh-hero-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 64px;
              align-items: center;
            }
            @media (max-width: 860px) {
              .rh-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
              .rh-hero-grid > div:last-child { display: none; }
            }
          `}</style>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            TESTIMONIALS
            ═══════════════════════════════════════════════════════════════ */}
        <section
          aria-label="Customer stories"
          style={{ padding: "0 0 80px", borderTop: `1px solid ${C.border}` }}
        >
          <div ref={testiRef} className="rh-container rh-testi-grid" style={{ paddingTop: 64 }}>
            {[
              {
                quote: "Six DVDs, all scratched. They recovered five completely. Only charged me for the five. Took 11 days.",
                name: "R. Kim",
                location: "Seattle, WA",
              },
              {
                quote: "I didn't have a DVD drive and didn't want to buy one for a single disc. USB arrived with every photo from my son's first year.",
                name: "L. Torres",
                location: "Phoenix, AZ",
              },
              {
                quote: "Two other services said my disc was unreadable. Heirvo got 89% of the files back — and only charged me for what they recovered.",
                name: "J. Whitfield",
                location: "Nashville, TN",
              },
            ].map(({ quote, name, location }) => (
              <article
                key={name}
                className="testi-card"
                style={{
                  background: C.pageAlt, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: "32px 28px",
                  display: "flex", flexDirection: "column" as const,
                  gap: 20, opacity: 0,
                }}
              >
                <div aria-hidden style={{
                  fontFamily: SORA, fontSize: 36, lineHeight: 0.7,
                  color: C.green, fontWeight: 700, opacity: 0.6,
                }}>
                  "
                </div>
                <blockquote style={{
                  margin: 0, padding: 0,
                  fontFamily: SORA, fontSize: 15, fontWeight: 400,
                  color: C.text, lineHeight: 1.65,
                  letterSpacing: "-0.01em", flex: 1,
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
            .rh-testi-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            @media (max-width: 900px) { .rh-testi-grid { grid-template-columns: 1fr !important; } }
            @media (min-width: 601px) and (max-width: 900px) { .rh-testi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          `}</style>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            HOW IT WORKS
            ═══════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="how-heading" style={{ padding: "96px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rh-how-grid">
              <div>
                <Eyebrow style={{ marginBottom: 16 }}>How it works</Eyebrow>
                <h2 id="how-heading" style={{
                  fontFamily: SORA, fontWeight: 700,
                  fontSize: "clamp(1.8rem, 3vw, 2.75rem)",
                  lineHeight: 1.1, letterSpacing: "-0.03em",
                  color: C.text, marginBottom: 20,
                }}>
                  Three steps.<br />Zero equipment.
                </h2>
                <p style={{
                  fontFamily: SORA, fontSize: 15, color: C.textMuted,
                  lineHeight: 1.7, maxWidth: 380, marginBottom: 40,
                }}>
                  You put the disc in a padded envelope. We do everything else — sector-by-sector
                  reading, error correction, format conversion. The kind of work that used to
                  require a specialist and a $500 quote.
                </p>
                {/* Guarantee callout */}
                <div style={{
                  padding: "24px 28px",
                  background: C.greenFaint,
                  border: `1px solid ${C.greenBorder}`,
                  borderRadius: 14,
                  display: "inline-block",
                  maxWidth: 340,
                }}>
                  <div style={{
                    fontFamily: SORA, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.14em", textTransform: "uppercase" as const,
                    color: C.green, marginBottom: 8,
                  }}>
                    Our guarantee
                  </div>
                  <p style={{
                    fontFamily: SORA, fontSize: 14, color: C.text,
                    lineHeight: 1.65, margin: 0,
                  }}>
                    <strong>No recovery, no charge.</strong> If we can't extract files from
                    a disc, the per-disc recovery fee is waived entirely. You only pay for
                    what we successfully recover.
                  </p>
                </div>
              </div>

              <div ref={stepsRef} style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
                {[
                  {
                    n: "01",
                    title: "Place your order",
                    body: "Fill out the order form below. Tell us your disc types, quantity, and how you'd like to receive your files. Pay the $19.99 intake fee to confirm. The whole process takes about two minutes.",
                  },
                  {
                    n: "02",
                    title: "Mail your disc",
                    body: "We email you our nearest regional address — we route orders to East and West Coast drop points to minimise transit time. Any padded bubble mailer works. Ship via any trackable carrier (USPS, UPS, FedEx).",
                  },
                  {
                    n: "03",
                    title: "Receive your files",
                    body: "We email you a confirmation photo when your disc arrives and a delivery notification when your files are ready — within 10–14 business days. Files come via secure cloud link, USB drive, or direct upload to Google Photos or iCloud.",
                  },
                ].map(({ n, title, body }, i) => (
                  <React.Fragment key={n}>
                    <div className="step-item" style={{
                      display: "grid", gridTemplateColumns: "72px 1fr",
                      gap: "0 24px", alignItems: "start",
                      padding: "36px 0", opacity: 0,
                    }}>
                      <div style={{
                        fontFamily: SORA, fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
                        fontWeight: 700, letterSpacing: "-0.05em",
                        color: C.border, lineHeight: 1, userSelect: "none",
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
                        <p style={{ fontFamily: SORA, fontSize: 14, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>
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
              .rh-how-grid {
                display: grid; grid-template-columns: 1fr 1fr;
                gap: 80px; align-items: start;
              }
              @media (max-width: 860px) {
                .rh-how-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
              }
            `}</style>
          </div>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            WHAT WE RECOVER — two columns
            ═══════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="what-heading" style={{ padding: "96px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <Eyebrow style={{ marginBottom: 16 }}>Disc types &amp; files</Eyebrow>
            <h2 id="what-heading" style={{
              fontFamily: SORA, fontWeight: 700,
              fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
              lineHeight: 1.1, letterSpacing: "-0.03em",
              color: C.text, marginBottom: 48,
            }}>
              Will this work for my disc?
            </h2>

            <div className="rh-what-grid">
              {/* Disc types */}
              <div style={{
                background: C.pageAlt, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "36px 32px",
              }}>
                <h3 style={{
                  fontFamily: SORA, fontSize: 14, fontWeight: 700,
                  color: C.text, letterSpacing: "-0.01em", marginBottom: 24,
                }}>
                  Disc types we accept
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 12 }}>
                  {[
                    { label: "DVD Video", note: "home movies, recorded TV, events" },
                    { label: "Kodak Photo CD", note: ".PCD files — 1990–2004 format", highlight: true },
                    { label: "Data CD / DVD-ROM", note: "files, documents, backups" },
                    { label: "Audio CD-R", note: "home recordings, music" },
                    { label: "DVD-R / DVD+R", note: "any home-burned disc" },
                    { label: "Blu-ray", note: "standard and recorded" },
                    { label: "Damaged or cracked discs", note: "even ones other services declined" },
                  ].map(({ label, note, highlight }) => (
                    <li key={label} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      fontFamily: SORA, fontSize: 13, lineHeight: 1.55,
                    }}>
                      <CheckIcon size={13} color={highlight ? C.amber : C.blue} />
                      <span>
                        <span style={{ color: highlight ? C.amber : C.text, fontWeight: highlight ? 600 : 400 }}>
                          {label}
                        </span>
                        <span style={{ color: C.textFaint }}> — {note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Files */}
              <div style={{
                background: C.pageAlt, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "36px 32px",
              }}>
                <h3 style={{
                  fontFamily: SORA, fontSize: 14, fontWeight: 700,
                  color: C.text, letterSpacing: "-0.01em", marginBottom: 24,
                }}>
                  Files we recover
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 12 }}>
                  {[
                    { label: "Videos", note: "MP4, VOB, M2TS, AVI" },
                    { label: "Photos", note: "JPEG, PNG, TIFF, PCD, RAW" },
                    { label: "Music", note: "WAV, MP3, FLAC" },
                    { label: "Documents", note: "PDF, DOC, XLS, ZIP" },
                    { label: "Disc images", note: "ISO — bit-perfect copy" },
                    { label: "Any file stored on the disc", note: "we extract everything readable" },
                  ].map(({ label, note }) => (
                    <li key={label} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      fontFamily: SORA, fontSize: 13, lineHeight: 1.55,
                    }}>
                      <CheckIcon size={13} color={C.blue} />
                      <span>
                        <span style={{ color: C.text }}>{label}</span>
                        <span style={{ color: C.textFaint }}> — {note}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Delivery options */}
                <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
                  <h4 style={{
                    fontFamily: SORA, fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.14em", textTransform: "uppercase" as const,
                    color: C.textFaint, marginBottom: 16,
                  }}>
                    Delivery options
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                    {[
                      { label: "Cloud download link", tag: "Free", note: "Private link, 30-day access" },
                      { label: "USB drive", tag: "+$19", note: "Ships with your original disc" },
                      { label: "Google Photos / iCloud", tag: "+$15", note: "We upload directly for you" },
                    ].map(({ label, tag, note }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: SORA, fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
                          <div style={{ fontFamily: SORA, fontSize: 11, color: C.textFaint }}>{note}</div>
                        </div>
                        <div style={{
                          fontFamily: SORA, fontSize: 12, fontWeight: 700,
                          color: tag === "Free" ? C.green : C.textMuted,
                          whiteSpace: "nowrap" as const,
                          background: tag === "Free" ? C.greenFaint : "rgba(255,255,255,0.05)",
                          border: `1px solid ${tag === "Free" ? C.greenBorder : C.border}`,
                          padding: "3px 10px", borderRadius: 100,
                        }}>
                          {tag}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <style>{`
              .rh-what-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
              }
              @media (max-width: 760px) { .rh-what-grid { grid-template-columns: 1fr !important; } }
            `}</style>
          </div>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            PRICING TABLE
            ═══════════════════════════════════════════════════════════════ */}
        <section id="pricing" aria-labelledby="pricing-heading" style={{ padding: "96px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <Eyebrow style={{ marginBottom: 16 }}>Transparent pricing</Eyebrow>
            <h2 id="pricing-heading" style={{
              fontFamily: SORA, fontWeight: 700,
              fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
              lineHeight: 1.1, letterSpacing: "-0.03em",
              color: C.text, marginBottom: 12,
            }}>
              No surprises. Pay only for what we recover.
            </h2>
            <p style={{
              fontFamily: SORA, fontSize: 16, color: C.textMuted,
              lineHeight: 1.7, marginBottom: 48, maxWidth: 520,
            }}>
              Plus a $19.99 intake fee per order (covers processing and return shipping) and tiered return shipping via USPS Flat Rate.
            </p>

            {/* Table */}
            <div ref={pricingRef} style={{
              border: `1px solid ${C.border}`, borderRadius: 14,
              overflow: "hidden", marginBottom: 24,
            }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                background: C.pageMid, padding: "14px 24px",
                borderBottom: `1px solid ${C.border}`,
              }}>
                {["Order size", "Per disc", "Total", "You save"].map((h) => (
                  <div key={h} style={{
                    fontFamily: SORA, fontSize: 10, letterSpacing: "0.14em",
                    textTransform: "uppercase" as const, fontWeight: 700, color: C.textFaint,
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              {[
                { size: "1 disc",    per: "$89",      total: "$89",         save: "—",          highlight: false },
                { size: "3 discs",   per: "$79 each", total: "$237",        save: "Save $30",   highlight: false },
                { size: "5 discs",   per: "$72 each", total: "$360",        save: "Save $85",   highlight: true  },
                { size: "10 discs",  per: "$65 each", total: "$650",        save: "Save $240",  highlight: false },
                { size: "20+ discs", per: "$59 each", total: "from $1,180", save: "Save $600+", highlight: false },
              ].map((row, i) => (
                <div
                  key={row.size}
                  className="price-row"
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    padding: "14px 24px",
                    background: row.highlight
                      ? `linear-gradient(90deg, rgba(10,132,255,0.08) 0%, ${C.pageAlt} 100%)`
                      : C.pageAlt,
                    borderTop: `1px solid ${C.border}`,
                    alignItems: "center",
                    opacity: 0,
                  }}
                >
                  <div style={{ fontFamily: SORA, fontSize: 14, fontWeight: row.highlight ? 700 : 600, color: C.text }}>
                    {row.size}
                  </div>
                  <div style={{ fontFamily: SORA, fontSize: 14, color: C.textMuted }}>{row.per}</div>
                  <div style={{ fontFamily: SORA, fontSize: 14, fontWeight: 600, color: C.text }}>{row.total}</div>
                  <div style={{
                    fontFamily: SORA, fontSize: 13,
                    color: row.highlight ? C.blue : C.textFaint,
                    fontWeight: row.highlight ? 700 : 400,
                  }}>
                    {row.save}
                  </div>
                </div>
              ))}
            </div>

            <p style={{
              fontFamily: SORA, fontSize: 12, color: C.textFaint,
              textAlign: "center", marginBottom: 40,
            }}>
              <strong style={{ color: C.textMuted }}>$19.99</strong> intake fee + return shipping: $10 (1–5 discs) · $17 (6–12) · $24 (13–20) · $45 (20+)
              &nbsp;·&nbsp; Rush processing: <strong style={{ color: C.textMuted }}>+$25</strong>
            </p>

            {/* Add-ons strip */}
            <div style={{
              display: "flex", gap: 16, flexWrap: "wrap" as const, justifyContent: "center",
            }}>
              {[
                { label: "USB drive", tag: "+$19" },
                { label: "Google Photos / iCloud upload", tag: "+$15" },
                { label: "Rush processing (5 days)", tag: "+$25" },
                { label: "Cloud download link", tag: "Free" },
              ].map(({ label, tag }) => (
                <div key={label} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", borderRadius: 100,
                  background: C.pageAlt, border: `1px solid ${C.border}`,
                  fontFamily: SORA, fontSize: 12,
                }}>
                  <span style={{ color: C.textMuted }}>{label}</span>
                  <span style={{
                    color: tag === "Free" ? C.green : C.blue,
                    fontWeight: 700,
                  }}>
                    {tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Rule style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }} />

        {/* ═══════════════════════════════════════════════════════════════
            FAQ
            ═══════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="faq-heading" style={{ padding: "96px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rh-faq-grid">
              <div>
                <Eyebrow style={{ marginBottom: 16 }}>FAQ</Eyebrow>
                <h2 id="faq-heading" style={{
                  fontFamily: SORA, fontWeight: 700,
                  fontSize: "clamp(1.6rem, 2.5vw, 2.25rem)",
                  lineHeight: 1.15, letterSpacing: "-0.03em",
                  color: C.text, marginBottom: 20,
                }}>
                  Questions we get every day.
                </h2>
                <p style={{
                  fontFamily: SORA, fontSize: 15, color: C.textMuted,
                  lineHeight: 1.7, maxWidth: 280, marginBottom: 32,
                }}>
                  Still not sure?{" "}
                  <a href="mailto:hello@heirvo.com" style={{ color: C.blue, textDecoration: "none" }}>
                    hello@heirvo.com
                  </a>
                  {" "}— we reply within one business day.
                </p>
              </div>

              <div ref={faqRef}>
                {[
                  {
                    q: "How do I send my disc in?",
                    a: "Fill out the order form and pay the $19.99 intake fee. We then email you our closest regional address and packaging instructions. Any padded bubble mailer works — put the disc in its case or a paper sleeve, seal it, and ship via any trackable carrier.",
                  },
                  {
                    q: "What if you can't recover anything?",
                    a: "You pay nothing for that disc. The $19.99 intake fee covers our processing and return shipping and is always retained. The per-disc recovery charge is waived entirely if we cannot extract files. Your original disc is always returned.",
                  },
                  {
                    q: "Do I need a DVD drive or any equipment?",
                    a: "No. The mail-in service requires nothing on your end — no disc drive, no software, no technical knowledge. You mail the disc. We do the rest.",
                  },
                  {
                    q: "How long does it take?",
                    a: "10–14 business days from when we receive your disc. Rush processing (5 business days) is available for +$25. We email a confirmation photo when your disc arrives.",
                  },
                  {
                    q: "Will my original disc come back?",
                    a: "Yes, always. Every order includes return shipping of the original disc regardless of the recovery outcome. We use USPS Flat Rate with tracking.",
                  },
                  {
                    q: "Can you recover a Kodak Photo CD?",
                    a: "Yes. Kodak Photo CDs use the .PCD format that Windows 10 and 11 can no longer open natively. We read the disc on professional equipment, extract the full-resolution scans — up to 18 megapixels — and deliver standard JPEG or TIFF files.",
                  },
                ].map(({ q, a }) => (
                  <FaqItem key={q} question={q} answer={a} />
                ))}
              </div>
            </div>

            <style>{`
              .rh-faq-grid {
                display: grid; grid-template-columns: 280px 1fr;
                gap: 64px; align-items: start;
              }
              @media (max-width: 860px) {
                .rh-faq-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
              }
            `}</style>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            ORDER FORM
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="order-form"
          aria-labelledby="form-heading"
          style={{
            padding: "0 32px 120px",
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Section header */}
            <div style={{
              background: `linear-gradient(135deg, ${C.pageMid} 0%, ${C.pageAlt} 100%)`,
              border: `1px solid ${C.borderMed}`,
              borderRadius: "20px 20px 0 0",
              padding: "clamp(40px, 5vw, 64px)",
              textAlign: "center",
              position: "relative" as const,
              overflow: "hidden",
            }}>
              <div aria-hidden style={{
                position: "absolute", top: -80, left: "50%",
                transform: "translateX(-50%)",
                width: 500, height: 200, borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(10,132,255,0.09) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
              <h2 id="form-heading" style={{
                fontFamily: SORA, fontWeight: 700,
                fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
                lineHeight: 1.1, letterSpacing: "-0.035em",
                color: C.text, marginBottom: 14,
                position: "relative" as const,
              }}>
                Get it done today.
              </h2>
              <p style={{
                fontFamily: SORA, fontSize: 16, color: C.textMuted,
                margin: "0 auto", maxWidth: 400, lineHeight: 1.65,
                position: "relative" as const,
              }}>
                Two minutes to fill out. We handle everything from here.
              </p>
            </div>

            {/* Form body */}
            <div style={{
              background: C.pageAlt,
              border: `1px solid ${C.borderMed}`,
              borderTop: "none",
              borderRadius: "0 0 20px 20px",
              padding: "clamp(32px, 5vw, 56px)",
            }}>

              {/* Pre-launch state */}
              {!HAS_FORMSPREE ? (
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${C.borderMed}`,
                  borderRadius: 12, padding: "40px",
                  textAlign: "center",
                }}>
                  <div style={{
                    fontFamily: SORA, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.18em", textTransform: "uppercase" as const,
                    color: C.blue, marginBottom: 12,
                  }}>
                    Orders opening soon
                  </div>
                  <p style={{
                    fontFamily: SORA, fontSize: 20, fontWeight: 700,
                    color: C.text, margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                  }}>
                    The order form is almost ready.
                  </p>
                  <p style={{
                    fontFamily: SORA, fontSize: 14, color: C.textMuted,
                    lineHeight: 1.7, margin: "0 0 28px",
                  }}>
                    In the meantime, email us and we'll handle your recovery personally.
                  </p>
                  <a
                    href="mailto:hello@heirvo.com"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      background: C.blue, color: "#FFFFFF",
                      fontFamily: SORA, fontWeight: 700, fontSize: 14,
                      padding: "14px 28px", borderRadius: 10,
                      textDecoration: "none",
                      boxShadow: "0 4px 20px rgba(10,132,255,0.3)",
                    }}
                  >
                    hello@heirvo.com
                  </a>
                </div>

              ) : submitted ? (
                /* ── Post-submit: Step 2 — pay intake fee ── */
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(10,132,255,0.12)",
                    border: `1px solid ${C.blueBorder}`,
                    borderRadius: 100, padding: "5px 14px",
                    fontFamily: SORA, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.14em", textTransform: "uppercase" as const,
                    color: C.blue, marginBottom: 24,
                  }}>
                    Step 2 of 2
                  </div>

                  <h3 style={{
                    fontFamily: SORA, fontSize: 26, fontWeight: 700,
                    color: C.text, marginBottom: 12, letterSpacing: "-0.02em", lineHeight: 1.15,
                  }}>
                    Order details saved.<br />One more step.
                  </h3>

                  <p style={{
                    fontFamily: SORA, fontSize: 15, color: C.textMuted,
                    lineHeight: 1.7, margin: "0 auto 32px", maxWidth: "42ch",
                  }}>
                    Pay the{" "}
                    <strong style={{ color: C.text }}>$19.99 non-refundable intake fee</strong>{" "}
                    to confirm your order. This covers our processing and return shipping.
                  </p>

                  <a
                    href={STRIPE_INTAKE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      background: C.text, color: C.page,
                      fontFamily: SORA, fontWeight: 700, fontSize: 16,
                      padding: "15px 32px", borderRadius: 12,
                      textDecoration: "none",
                      transition: "opacity 0.18s",
                      boxShadow: "0 6px 32px rgba(0,0,0,0.3)",
                      marginBottom: 24,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M1 10h22" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Pay $19.99 intake fee →
                  </a>

                  <p style={{
                    fontFamily: SORA, fontSize: 12, color: C.textFaint,
                    lineHeight: 1.65, maxWidth: 420, margin: "0 auto",
                  }}>
                    Once payment clears, we'll email you packing instructions and the closest
                    shipping address. Questions?{" "}
                    <a href="mailto:hello@heirvo.com" style={{ color: C.textFaint, textDecoration: "underline" }}>
                      hello@heirvo.com
                    </a>
                  </p>
                </div>

              ) : (
                /* ── Live form ── */
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: 28 }}>

                  {/* Disc types */}
                  <div>
                    <label style={labelStyle}>What are you sending us?</label>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 6 }}>
                      {["DVD Video", "Photo CD", "Kodak Photo CD", "Data CD", "Audio CD", "Blu-ray", "DVD-R / DVD+R", "Other"].map((type) => (
                        <label key={type} className="disc-type-chip" style={{
                          display: "flex", alignItems: "center", gap: 6,
                          fontFamily: SORA, fontSize: 13,
                          color: discTypes.includes(type) ? C.text : C.textMuted,
                          cursor: "pointer",
                          padding: "8px 14px",
                          border: `1px solid ${discTypes.includes(type) ? C.blue : C.border}`,
                          borderRadius: 8,
                          background: discTypes.includes(type) ? C.blueFaint : "transparent",
                          transition: "all 160ms",
                          userSelect: "none" as const,
                        }}>
                          <input
                            type="checkbox"
                            checked={discTypes.includes(type)}
                            onChange={() => toggleDiscType(type)}
                            style={{ accentColor: C.blue, width: 13, height: 13, flexShrink: 0 }}
                          />
                          {type === "Kodak Photo CD" ? (
                            <span style={{ color: discTypes.includes(type) ? C.amber : C.textMuted }}>
                              {type}
                            </span>
                          ) : type}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Disc quantity */}
                  <div>
                    <label style={labelStyle} htmlFor="rh-qty">How many discs?</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <input
                        id="rh-qty"
                        type="number" min={1} max={999} required
                        value={discQty}
                        onChange={(e) => setDiscQty(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...fieldBase, width: 100 }}
                      />
                      <div style={{
                        fontFamily: SORA, fontSize: 13,
                        color: C.blue, fontWeight: 600,
                      }}>
                        Estimated total: {priceLabel(discQty, addOnCost)}
                        <span style={{ color: C.textFaint, fontWeight: 400 }}> (incl. intake fee + shipping)</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div>
                    <label style={labelStyle}>How would you like to receive your files?</label>
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginTop: 6 }}>
                      {([
                        { value: "cloud",  label: "Cloud download link",         note: "Free · private link, 30-day access" },
                        { value: "usb",    label: "USB drive + cloud",            note: "+$19 · ships with your disc" },
                        { value: "upload", label: "Google Photos / iCloud upload", note: "+$15 · we upload directly" },
                      ] as const).map((opt) => (
                        <label key={opt.value} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          cursor: "pointer",
                          padding: "12px 14px",
                          border: `1px solid ${delivery === opt.value ? C.blueBorder : C.border}`,
                          borderRadius: 8,
                          background: delivery === opt.value ? C.blueFaint : "transparent",
                          transition: "all 160ms",
                        }}>
                          <input
                            type="radio" name="delivery" value={opt.value}
                            checked={delivery === opt.value}
                            onChange={() => setDelivery(opt.value)}
                            style={{ accentColor: C.blue, width: 15, height: 15, flexShrink: 0 }}
                          />
                          <div>
                            <div style={{ fontFamily: SORA, fontSize: 13, fontWeight: 600, color: delivery === opt.value ? C.text : C.textMuted }}>
                              {opt.label}
                            </div>
                            <div style={{ fontFamily: SORA, fontSize: 11, color: C.textFaint }}>{opt.note}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Rush */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                    padding: "12px 14px",
                    border: `1px solid ${rush ? C.amberBorder : C.border}`,
                    borderRadius: 8,
                    background: rush ? C.amberFaint : "transparent",
                    transition: "all 160ms",
                  }}>
                    <input
                      type="checkbox" checked={rush}
                      onChange={(e) => setRush(e.target.checked)}
                      style={{ accentColor: C.amber, width: 15, height: 15, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontFamily: SORA, fontSize: 13, fontWeight: 600, color: rush ? C.amber : C.textMuted }}>
                        Rush processing
                      </div>
                      <div style={{ fontFamily: SORA, fontSize: 11, color: C.textFaint }}>+$25 · 5 business days instead of 10–14</div>
                    </div>
                  </label>

                  <Rule />

                  {/* Name */}
                  <div>
                    <label style={labelStyle} htmlFor="rh-name">Your name</label>
                    <input id="rh-name" type="text" required placeholder="Jane Smith"
                      value={name} onChange={(e) => setName(e.target.value)} style={fieldBase} />
                  </div>

                  {/* Email */}
                  <div>
                    <label style={labelStyle} htmlFor="rh-email">Email address</label>
                    <input id="rh-email" type="email" required placeholder="jane@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} style={fieldBase} />
                  </div>

                  {/* Phone */}
                  <div>
                    <label style={labelStyle} htmlFor="rh-phone">Phone (optional)</label>
                    <input id="rh-phone" type="tel" placeholder="+1 (555) 000-0000"
                      value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldBase} />
                    <div style={{ marginTop: 5, fontFamily: SORA, fontSize: 11, color: C.textFaint }}>
                      Only if we have a question about your disc
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label style={labelStyle} htmlFor="rh-address">Return shipping address</label>
                    <textarea id="rh-address" required rows={3}
                      placeholder={"123 Main St\nSpringfield, IL 62701"}
                      value={address} onChange={(e) => setAddress(e.target.value)}
                      style={{ ...fieldBase, resize: "vertical" as const }} />
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={labelStyle} htmlFor="rh-notes">Anything we should know? (optional)</label>
                    <textarea id="rh-notes" rows={2}
                      placeholder="e.g. disc has a crack near the edge, previously attempted recovery elsewhere..."
                      value={notes} onChange={(e) => setNotes(e.target.value)}
                      style={{ ...fieldBase, resize: "vertical" as const }} />
                  </div>

                  {/* Submit */}
                  <div>
                    <button
                      ref={submitBtnRef}
                      type="submit" disabled={busy}
                      style={{
                        width: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: busy ? C.textFaint : C.blue, color: "#FFFFFF",
                        fontFamily: SORA, fontWeight: 700, fontSize: 16,
                        padding: "16px", border: "none", borderRadius: 10,
                        cursor: busy ? "not-allowed" : "pointer",
                        transition: "background 0.18s, box-shadow 0.18s",
                        boxShadow: busy ? "none" : "0 4px 24px rgba(10,132,255,0.35)",
                      }}
                      onMouseEnter={(e) => {
                        if (!busy) {
                          (e.currentTarget as HTMLElement).style.background = C.blueHover;
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 32px rgba(10,132,255,0.50)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!busy) {
                          (e.currentTarget as HTMLElement).style.background = C.blue;
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(10,132,255,0.35)";
                        }
                      }}
                    >
                      {busy ? "Sending…" : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Send my order →
                        </>
                      )}
                    </button>
                    <div style={{
                      marginTop: 14, fontFamily: SORA, fontSize: 11,
                      color: C.textFaint, textAlign: "center", lineHeight: 1.6,
                    }}>
                      Secure · No recovery, no charge · $19.99 intake fee retained · Your originals always returned
                      · Questions?{" "}
                      <a href="mailto:hello@heirvo.com" style={{ color: C.textFaint, textDecoration: "underline" }}>
                        hello@heirvo.com
                      </a>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

      </main>

      <Footer />

      <style>{`
        .rh-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px;
        }
        body:has(.rh-root) {
          background: #0B1220 !important;
        }
        input:focus, textarea:focus {
          border-color: #0A84FF !important;
          box-shadow: 0 0 0 3px rgba(10,132,255,0.15);
        }
        select option { background: #0B1220; color: #fff; }
        @media (max-width: 640px) {
          .rh-container { padding: 0 16px; }
        }
      `}</style>
    </div>
  );
}
