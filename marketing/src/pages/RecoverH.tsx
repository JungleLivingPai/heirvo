import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import {
  splitReveal,
  staggerReveal,
  clipReveal,
  magneticHover,
} from "../lib/gsap-fx";

// ─── Design tokens ────────────────────────────────────────────────────────────

const SANS = '"Inter", ui-sans-serif, system-ui, sans-serif';

const C = {
  white:       "#FFFFFF",
  ink:         "#0A0A0A",
  blue:        "#0A84FF",
  blueLight:   "rgba(10,132,255,0.10)",
  navy:        "#0B1220",
  navyMid:     "rgba(11,18,32,0.95)",
  grey:        "#F5F5F5",
  greyBorder:  "#E8E8E8",
  inkMid:      "#444444",
  inkMute:     "#888888",
  inkFaint:    "#BBBBBB",
  white60:     "rgba(255,255,255,0.60)",
  white20:     "rgba(255,255,255,0.20)",
  white10:     "rgba(255,255,255,0.10)",
  white06:     "rgba(255,255,255,0.06)",
};

const FORMSPREE_ENDPOINT = `https://formspree.io/f/${
  (import.meta.env.VITE_FORMSPREE_ID as string) || "YOUR_FORM_ID"
}`;
const HAS_FORMSPREE = !!(import.meta.env.VITE_FORMSPREE_ID as string);
const STRIPE_INTAKE_URL: string =
  (import.meta.env.VITE_STRIPE_INTAKE_URL as string) ||
  "https://buy.stripe.com/test_8x23cn66W4i22jc3dGdEs00";

// ─── Pricing calculator helper ────────────────────────────────────────────────

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

// ─── Shared primitive components ──────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily:    SANS,
        fontSize:      11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color:         C.blue,
        fontWeight:    600,
        marginBottom:  "1rem",
      }}
    >
      {children}
    </div>
  );
}

function CheckRow({ items }: { items: string[] }) {
  return (
    <div
      style={{
        display:   "flex",
        flexWrap:  "wrap",
        gap:       "0.65rem 1.5rem",
        marginTop: "1.75rem",
      }}
    >
      {items.map((item) => (
        <span
          key={item}
          style={{
            fontFamily: SANS,
            fontSize:   13,
            color:      C.inkMid,
            display:    "flex",
            alignItems: "center",
            gap:        "0.4rem",
          }}
        >
          <span style={{ color: C.blue, fontWeight: 700, fontSize: 15 }}>✓</span>
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecoverH() {
  // ── Form state ──────────────────────────────────────────────────────────────
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
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          disc_types:       discTypes.join(", ") || "Not specified",
          disc_quantity:    discQty,
          delivery_option:  delivery === "cloud" ? "Cloud download (free)" : delivery === "usb" ? "USB drive (+$19)" : "Google Photos / iCloud (+$15)",
          rush_processing:  rush ? "Yes (+$25)" : "No",
          name,
          email,
          phone:            phone || "(not provided)",
          return_address:   address,
          notes:            notes || "(none)",
          estimated_total:  priceLabel(discQty, addOnCost),
        }),
      });
      if (res.ok) setSubmitted(true);
      else alert("Something went wrong — please email hello@heirvo.com directly.");
    } finally {
      setBusy(false);
    }
  };

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const heroHeadlineRef  = useRef<HTMLHeadingElement>(null);
  const heroImgRef       = useRef<HTMLDivElement>(null);
  const heroCTAPrimRef   = useRef<HTMLAnchorElement>(null);
  const howItWorksRef    = useRef<HTMLDivElement>(null);
  const pricingRowsRef   = useRef<HTMLDivElement>(null);
  const faqRef           = useRef<HTMLDivElement>(null);
  const submitBtnRef     = useRef<HTMLButtonElement>(null);

  // ── GSAP ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      const cleanups: Array<() => void> = [];

      if (heroHeadlineRef.current) {
        cleanups.push(splitReveal(heroHeadlineRef.current, { duration: 1.05, stagger: 0.14, delay: 0.2, ease: "cinematic" }));
      }
      if (heroImgRef.current) {
        cleanups.push(clipReveal(heroImgRef.current, { direction: "right", duration: 1.1, delay: 0.35 }));
      }
      if (heroCTAPrimRef.current) {
        cleanups.push(magneticHover(heroCTAPrimRef.current, 0.4));
      }
      if (howItWorksRef.current) {
        cleanups.push(staggerReveal(howItWorksRef.current, ".how-col", { y: 48, stagger: 0.13 }));
      }
      if (pricingRowsRef.current) {
        cleanups.push(staggerReveal(pricingRowsRef.current, ".price-row", { y: 28, stagger: 0.08 }));
      }
      if (faqRef.current) {
        cleanups.push(staggerReveal(faqRef.current, ".faq-item", { y: 32, stagger: 0.09 }));
      }
      if (submitBtnRef.current) {
        cleanups.push(magneticHover(submitBtnRef.current, 0.4));
      }

      return () => cleanups.forEach((fn) => fn());
    });

    return () => ctx.revert();
  }, []);

  // ── Shared input style ───────────────────────────────────────────────────────
  const fieldBase: React.CSSProperties = {
    width:        "100%",
    boxSizing:    "border-box",
    background:   C.white06,
    border:       `1px solid ${C.white20}`,
    padding:      "11px 14px",
    fontSize:     14,
    color:        C.white,
    fontFamily:   SANS,
    outline:      "none",
    borderRadius: 4,
    transition:   "border-color 180ms",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily:    SANS,
    fontSize:      11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color:         C.white60,
    display:       "block",
    marginBottom:  5,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: C.white,
        color:      C.ink,
        fontFamily: SANS,
        overflowX:  "hidden",
        minHeight:  "100vh",
      }}
    >

      {/* ── Global styles ── */}
      <style>{`
        @media (max-width: 768px) {
          .hero-grid    { grid-template-columns: 1fr !important; }
          .hero-grid > div:last-child { display: none !important; }
          .what-grid    { grid-template-columns: 1fr !important; }
          .how-grid     { grid-template-columns: 1fr !important; }
          .price-table  { font-size: 13px !important; }
        }

        @media (max-width: 580px) {
          .price-header {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
          .price-header > div:nth-child(4) { display: none !important; }
          .price-row {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
          .price-row > div:nth-child(4) { display: none !important; }
        }

        input:focus, select:focus, textarea:focus {
          border-color: #0A84FF !important;
          box-shadow: 0 0 0 3px rgba(10,132,255,0.15);
        }
        select option { background: #0B1220; color: #fff; }

        a { color: inherit; }

        .recover-h-cta-primary:hover { opacity: 0.88; }
        .recover-h-cta-secondary:hover { color: #0A84FF !important; }
      `}</style>

      {/* ─────────────────────────────────────────── 1. NAV */}
      <Nav />

      {/* ═══════════════════════════════════════════ 2. HERO */}
      <section
        style={{
          maxWidth: 1200,
          margin:   "0 auto",
          padding:  "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem) clamp(4rem,8vh,7rem)",
        }}
      >
        <div
          className="hero-grid"
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 "clamp(3rem,6vw,6rem)",
            alignItems:          "center",
          }}
        >
          {/* Left — copy */}
          <div>
            <Eyebrow>No drive. No time. No problem.</Eyebrow>

            <h1
              ref={heroHeadlineRef}
              style={{
                fontFamily:    SANS,
                fontSize:      "clamp(36px,4.8vw,62px)",
                fontWeight:    700,
                lineHeight:    1.08,
                letterSpacing: "-0.03em",
                color:         C.ink,
                margin:        0,
              }}
            >
              Mail us your disc. We recover everything on it.
            </h1>

            <p
              style={{
                fontFamily: SANS,
                fontSize:   "clamp(15px,1.6vw,18px)",
                color:      C.inkMid,
                lineHeight: 1.7,
                marginTop:  "1.5rem",
                maxWidth:   "48ch",
              }}
            >
              DVDs, photo CDs, audio CDs, data discs — even damaged or scratched ones. We do
              the recovery. You get your files back on a USB drive. No equipment needed.
            </p>

            {/* CTA row */}
            <div
              style={{
                display:    "flex",
                gap:        "1rem",
                marginTop:  "2.25rem",
                flexWrap:   "wrap",
                alignItems: "center",
              }}
            >
              <a
                ref={heroCTAPrimRef}
                href="#order-form"
                className="recover-h-cta-primary"
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            "0.5rem",
                  background:     C.blue,
                  color:          C.white,
                  fontFamily:     SANS,
                  fontWeight:     600,
                  fontSize:       15,
                  padding:        "0.875rem 1.75rem",
                  borderRadius:   6,
                  textDecoration: "none",
                  transition:     "opacity 180ms",
                }}
              >
                Get it done today →
              </a>

              <Link
                to="#pricing"
                className="recover-h-cta-secondary"
                style={{
                  fontFamily:     SANS,
                  fontSize:       14,
                  fontWeight:     500,
                  color:          C.inkMid,
                  textDecoration: "none",
                  transition:     "color 180ms",
                }}
              >
                See pricing
              </Link>
            </div>

            {/* Trust micro-row */}
            <CheckRow items={[
              "No recovery, no charge",
              "Original disc returned",
              "Files on USB or cloud",
              "10–14 day turnaround",
            ]} />
          </div>

          {/* Right — image */}
          <div
            ref={heroImgRef}
            style={{
              display:        "flex",
              justifyContent: "center",
              alignItems:     "center",
            }}
          >
            <img
              src="/assets/mail-in-disc.png"
              alt="Mail-in disc recovery service"
              style={{
                width:      "min(1260px,100%)",
                height:     "auto",
                objectFit:  "contain",
                filter:     "drop-shadow(0 24px 48px rgba(0,0,0,0.14))",
                userSelect: "none",
              }}
              onError={(e) => {
                // Hide image if it fails to load
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 3. NO DVD DRIVE BAND */}
      <section
        style={{
          background: C.grey,
          padding:    "clamp(4rem,8vh,6rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontFamily:    SANS,
              fontSize:      "clamp(24px,3vw,38px)",
              fontWeight:    700,
              letterSpacing: "-0.025em",
              lineHeight:    1.15,
              color:         C.ink,
              margin:        "0 0 1.25rem",
            }}
          >
            Laptops don't come with DVD drives anymore.
          </h2>

          <p
            style={{
              fontFamily: SANS,
              fontSize:   "clamp(15px,1.6vw,17px)",
              color:      C.inkMid,
              lineHeight: 1.75,
              margin:     "0 auto 1.75rem",
              maxWidth:   "58ch",
            }}
          >
            If you tried to play your disc recently and found out the hard way — you're not
            alone. Most modern laptops, including MacBooks and the latest Windows machines,
            removed the DVD drive years ago. You don't need to buy hardware, install software,
            or spend a weekend figuring it out. Mail us the disc.
          </p>

          <a
            href="#order-form"
            style={{
              fontFamily:     SANS,
              fontSize:       14,
              fontWeight:     600,
              color:          C.blue,
              textDecoration: "none",
            }}
          >
            Skip the equipment — let us handle it →
          </a>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 4. HOW IT WORKS */}
      <section
        id="how-it-works"
        style={{
          maxWidth: 1200,
          margin:   "0 auto",
          padding:  "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <Eyebrow>How it works</Eyebrow>
          <h2
            style={{
              fontFamily:    SANS,
              fontSize:      "clamp(26px,3.2vw,40px)",
              fontWeight:    700,
              letterSpacing: "-0.025em",
              lineHeight:    1.12,
              color:         C.ink,
              margin:        0,
            }}
          >
            Three steps. Zero equipment required.
          </h2>
        </div>

        <div
          ref={howItWorksRef}
          className="how-grid"
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap:                 "clamp(1.5rem,3vw,3rem)",
          }}
        >
          {[
            {
              n: "1",
              title: "Mail us your disc",
              body: "Any padded envelope works. We'll give you our exact address and packaging instructions after you order.",
            },
            {
              n: "2",
              title: "We recover your files",
              body: "Sector-by-sector reading on professional equipment. We try multiple passes on every disc. No recovery, no charge.",
            },
            {
              n: "3",
              title: "We send everything back",
              body: "Your original disc plus your files on USB or a private cloud link. 10–14 business days from receipt.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="how-col"
              style={{
                borderTop:   `3px solid ${C.blue}`,
                paddingTop:  "1.75rem",
              }}
            >
              <div
                style={{
                  fontFamily:  SANS,
                  fontSize:    "clamp(40px,5vw,64px)",
                  fontWeight:  800,
                  color:       C.greyBorder,
                  lineHeight:  1,
                  marginBottom:"0.5rem",
                }}
              >
                {step.n}
              </div>
              <h3
                style={{
                  fontFamily:    SANS,
                  fontSize:      "clamp(17px,1.8vw,21px)",
                  fontWeight:    700,
                  letterSpacing: "-0.015em",
                  color:         C.ink,
                  margin:        "0 0 0.75rem",
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize:   14,
                  color:      C.inkMid,
                  lineHeight: 1.75,
                  margin:     0,
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 5. WHAT WE RECOVER */}
      <section
        style={{
          background: C.grey,
          padding:    "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <Eyebrow>Disc types &amp; file formats</Eyebrow>
            <h2
              style={{
                fontFamily:    SANS,
                fontSize:      "clamp(26px,3.2vw,40px)",
                fontWeight:    700,
                letterSpacing: "-0.025em",
                lineHeight:    1.12,
                color:         C.ink,
                margin:        0,
              }}
            >
              Will this work for my disc?
            </h2>
          </div>

          <div
            className="what-grid"
            style={{
              display:             "grid",
              gridTemplateColumns: "1fr 1fr",
              gap:                 "2rem",
            }}
          >
            {/* Disc types */}
            <div
              style={{
                background:   C.white,
                borderRadius: 8,
                padding:      "2rem",
                border:       `1px solid ${C.greyBorder}`,
              }}
            >
              <h3
                style={{
                  fontFamily:    SANS,
                  fontSize:      16,
                  fontWeight:    700,
                  color:         C.ink,
                  margin:        "0 0 1.25rem",
                  letterSpacing: "-0.01em",
                }}
              >
                Disc types we accept
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                {[
                  "DVD Video (home movies, recorded TV, events)",
                  "Photo CD (prints scanned at the photo lab)",
                  "Data CD / DVD-ROM (files, documents, backups)",
                  "Audio CD-R (home recordings, music)",
                  "Burned DVD-R / DVD+R (any home-burned disc)",
                  "Blu-ray (standard and recorded)",
                  "Damaged or scratched discs — even ones other services declined",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily:  SANS,
                      fontSize:    14,
                      color:       C.inkMid,
                      lineHeight:  1.6,
                      display:     "flex",
                      gap:         "0.6rem",
                      alignItems:  "flex-start",
                    }}
                  >
                    <span style={{ color: C.blue, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* File types */}
            <div
              style={{
                background:   C.white,
                borderRadius: 8,
                padding:      "2rem",
                border:       `1px solid ${C.greyBorder}`,
              }}
            >
              <h3
                style={{
                  fontFamily:    SANS,
                  fontSize:      16,
                  fontWeight:    700,
                  color:         C.ink,
                  margin:        "0 0 1.25rem",
                  letterSpacing: "-0.01em",
                }}
              >
                Files we recover
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                {[
                  "Videos — MP4, VOB, M2TS, AVI",
                  "Photos — JPEG, PNG, TIFF, RAW",
                  "Music — WAV, MP3, FLAC",
                  "Documents — PDF, DOC, XLS, ZIP",
                  "Disc images — ISO (bit-perfect copy)",
                  "Any file stored on the disc",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily:  SANS,
                      fontSize:    14,
                      color:       C.inkMid,
                      lineHeight:  1.6,
                      display:     "flex",
                      gap:         "0.6rem",
                      alignItems:  "flex-start",
                    }}
                  >
                    <span style={{ color: C.blue, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 6. PRICING */}
      <section
        id="pricing"
        style={{
          maxWidth: 1200,
          margin:   "0 auto",
          padding:  "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <Eyebrow>Pricing</Eyebrow>
          <h2
            style={{
              fontFamily:    SANS,
              fontSize:      "clamp(26px,3.2vw,40px)",
              fontWeight:    700,
              letterSpacing: "-0.025em",
              lineHeight:    1.12,
              color:         C.ink,
              margin:        "0 auto 0.75rem",
            }}
          >
            Transparent pricing. No surprises.
          </h2>
          <p
            style={{
              fontFamily: SANS,
              fontSize:   15,
              color:      C.inkMid,
              margin:     0,
            }}
          >
            Plus a $19.99 intake fee and tiered return shipping per order.
          </p>
        </div>

        {/* Pricing table */}
        <div
          ref={pricingRowsRef}
          style={{
            border:       `1px solid ${C.greyBorder}`,
            borderRadius: 8,
            overflow:     "hidden",
            marginBottom: "2rem",
          }}
        >
          {/* Header */}
          <div
            className="price-header"
            style={{
              display:             "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              background:          C.ink,
              padding:             "0.875rem 1.5rem",
            }}
          >
            {["Order Size", "Per Disc", "Total", "You Save"].map((h) => (
              <div
                key={h}
                style={{
                  fontFamily:    SANS,
                  fontSize:      11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight:    600,
                  color:         C.white60,
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {[
            { size: "1 disc",    per: "$89",       total: "$89",          save: "—",          highlight: false },
            { size: "3 discs",   per: "$79 each",  total: "$237",         save: "Save $30",   highlight: false },
            { size: "5 discs",   per: "$72 each",  total: "$360",         save: "Save $85",   highlight: true  },
            { size: "10 discs",  per: "$65 each",  total: "$650",         save: "Save $240",  highlight: false },
            { size: "20+ discs", per: "$59 each",  total: "from $1,180",  save: "Save $600+", highlight: false },
          ].map((row, i) => (
            <div
              key={row.size}
              className="price-row"
              style={{
                display:             "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                padding:             "0.9rem 1.5rem",
                background:          row.highlight ? C.blueLight : i % 2 === 0 ? C.white : C.grey,
                borderTop:           `1px solid ${C.greyBorder}`,
                alignItems:          "center",
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.ink }}>{row.size}</div>
              <div style={{ fontFamily: SANS, fontSize: 14, color: C.inkMid }}>{row.per}</div>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.ink }}>{row.total}</div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize:   13,
                  color:      row.highlight ? C.blue : C.inkMute,
                  fontWeight: row.highlight ? 600 : 400,
                }}
              >
                {row.save}
              </div>
            </div>
          ))}
        </div>

        {/* Shipping note */}
        <p
          style={{
            fontFamily: SANS,
            fontSize:   13,
            color:      C.inkMute,
            textAlign:  "center",
            margin:     "0 0 2.5rem",
          }}
        >
          <strong style={{ color: C.inkMid }}>$19.99</strong> non-refundable intake fee per order + tiered return shipping via USPS Flat Rate: $10 (1–5 discs) · $17 (6–12) · $24 (13–20) · $45 (20+).
        </p>

        {/* Guarantee box */}
        <div
          style={{
            border:       `2px solid ${C.blue}`,
            borderRadius: 8,
            padding:      "1.75rem 2rem",
            background:   C.blueLight,
            marginBottom: "2.5rem",
            maxWidth:     760,
            margin:       "0 auto 2.5rem",
          }}
        >
          <div
            style={{
              fontFamily:   SANS,
              fontSize:     13,
              fontWeight:   700,
              letterSpacing:"0.1em",
              textTransform:"uppercase",
              color:        C.blue,
              marginBottom: "0.6rem",
            }}
          >
            Our guarantee
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize:   15,
              color:      C.ink,
              lineHeight: 1.7,
              margin:     0,
            }}
          >
            <strong>No recovery, no charge.</strong> If we can't extract files from a disc,
            you pay $0 for that disc. The $19.99 intake fee covers our processing and return
            shipping — it's retained regardless. The per-disc recovery charge is waived entirely.
          </p>
        </div>

        {/* Add-ons */}
        <div
          style={{
            maxWidth:     760,
            margin:       "0 auto 2.5rem",
          }}
        >
          <h3
            style={{
              fontFamily:    SANS,
              fontSize:      16,
              fontWeight:    700,
              color:         C.ink,
              margin:        "0 0 1rem",
              letterSpacing: "-0.01em",
            }}
          >
            Add-ons
          </h3>
          <ul
            style={{
              listStyle: "none",
              padding:   0,
              margin:    0,
              display:   "flex",
              flexDirection: "column",
              gap:       "0.6rem",
            }}
          >
            {[
              "USB drive with files: +$19/order",
              "Direct Google Photos or iCloud upload: +$15/order",
              "Rush processing (5 business days): +$25/order",
              "Cloud download link: Included free with every order",
            ].map((item) => (
              <li
                key={item}
                style={{
                  fontFamily:  SANS,
                  fontSize:    14,
                  color:       C.inkMid,
                  display:     "flex",
                  gap:         "0.6rem",
                  alignItems:  "flex-start",
                }}
              >
                <span style={{ color: C.blue, fontWeight: 700 }}>+</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Delivery options */}
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h3
            style={{
              fontFamily:    SANS,
              fontSize:      16,
              fontWeight:    700,
              color:         C.ink,
              margin:        "0 0 1rem",
              letterSpacing: "-0.01em",
            }}
          >
            Delivery options
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              {
                n:     "1",
                title: "USB Drive",
                desc:  "Files on a 32GB USB, shipped with your original. Plug into any TV or laptop.",
                tag:   "+$19",
              },
              {
                n:     "2",
                title: "Cloud Download Link",
                desc:  "Private link, 30-day access. Download on any device.",
                tag:   "Free",
              },
              {
                n:     "3",
                title: "Direct Upload",
                desc:  "We put your files directly into your Google Photos or iCloud.",
                tag:   "+$15",
              },
            ].map((opt) => (
              <div
                key={opt.n}
                style={{
                  display:      "flex",
                  gap:          "1rem",
                  alignItems:   "center",
                  padding:      "0.875rem 1.25rem",
                  border:       `1px solid ${C.greyBorder}`,
                  borderRadius: 6,
                  background:   C.white,
                }}
              >
                <div
                  style={{
                    width:          28,
                    height:         28,
                    borderRadius:   "50%",
                    background:     C.blueLight,
                    color:          C.blue,
                    fontFamily:     SANS,
                    fontWeight:     700,
                    fontSize:       13,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    flexShrink:     0,
                  }}
                >
                  {opt.n}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.ink }}>{opt.title}</div>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: C.inkMute }}>{opt.desc}</div>
                </div>
                <div
                  style={{
                    fontFamily:  SANS,
                    fontSize:    13,
                    fontWeight:  600,
                    color:       opt.tag === "Free" ? C.blue : C.inkMid,
                    whiteSpace:  "nowrap",
                  }}
                >
                  {opt.tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 7. TESTIMONIALS */}
      <section
        style={{
          background: C.grey,
          padding:    "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <Eyebrow>Customer stories</Eyebrow>
            <h2
              style={{
                fontFamily:    SANS,
                fontSize:      "clamp(24px,3vw,36px)",
                fontWeight:    700,
                letterSpacing: "-0.025em",
                lineHeight:    1.12,
                color:         C.ink,
                margin:        0,
              }}
            >
              Real recoveries. Real people.
            </h2>
          </div>

          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap:                 "1.5rem",
            }}
          >
            {[
              {
                quote: "Six DVDs, all scratched. They recovered five completely and got partial files off the sixth. Only charged me for the five. Took 11 days.",
                name:  "Robert Kim",
                loc:   "Seattle, WA",
              },
              {
                quote: "I didn't have a DVD drive and didn't want to buy one for a single disc. Best decision I made. USB drive arrived with every photo from my son's first year.",
                name:  "Linda Torres",
                loc:   "Phoenix, AZ",
              },
              {
                quote: "Two other services said my disc was unreadable. Heirvo got 89% of the files back. And they only charged me for what they recovered.",
                name:  "James Whitfield",
                loc:   "Nashville, TN",
              },
            ].map((t) => (
              <div
                key={t.name}
                style={{
                  background:   C.white,
                  borderRadius: 8,
                  padding:      "1.75rem",
                  border:       `1px solid ${C.greyBorder}`,
                  display:      "flex",
                  flexDirection:"column",
                  gap:          "1.25rem",
                }}
              >
                <p
                  style={{
                    fontFamily: SANS,
                    fontSize:   15,
                    color:      C.ink,
                    lineHeight: 1.7,
                    margin:     0,
                    flex:       1,
                  }}
                >
                  "{t.quote}"
                </p>
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.ink }}>
                    — {t.name}
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: C.inkMute }}>
                    {t.loc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 8. FAQ */}
      <section
        style={{
          maxWidth: 800,
          margin:   "0 auto",
          padding:  "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <Eyebrow>FAQ</Eyebrow>
          <h2
            style={{
              fontFamily:    SANS,
              fontSize:      "clamp(24px,3vw,36px)",
              fontWeight:    700,
              letterSpacing: "-0.025em",
              lineHeight:    1.12,
              color:         C.ink,
              margin:        0,
            }}
          >
            Questions we get every day.
          </h2>
        </div>

        <div ref={faqRef} style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {[
            {
              q: "Where do I ship my disc?",
              a: "After your $19.99 intake fee clears, we email you the closest shipping address from our regional drop points (East and West Coast). This routing cuts transit time in half compared to services that ship everything to one warehouse.",
            },
            {
              q: "What if my disc gets lost in the mail?",
              a: "Use a trackable carrier (USPS Priority, UPS, FedEx). We email you a confirmation photo the moment your disc arrives at our facility. If a disc doesn't arrive within 10 business days of your tracking marking it delivered, we refund the intake fee in full.",
            },
            {
              q: "Is my disc actually going to come back?",
              a: "Yes. Every order. We return the original disc with your delivery regardless of outcome.",
            },
            {
              q: "What if you can't recover anything?",
              a: "You pay $0 for that disc. The $19.99 intake fee covers our processing and return shipping and is always retained. The recovery fee itself is fully waived.",
            },
            {
              q: "How do I package the disc?",
              a: "A padded bubble mailer works perfectly. Put the disc in its case or a paper sleeve. Don't stack bare discs. We send packaging instructions in your order confirmation.",
            },
            {
              q: "How long does it take?",
              a: "10–14 business days from when we receive it. Rush orders (5 business days) available for +$25.",
            },
          ].map((item, i) => (
            <div
              key={item.q}
              className="faq-item"
              style={{
                padding:   "1.5rem 0",
                borderBottom: `1px solid ${C.greyBorder}`,
                borderTop:    i === 0 ? `1px solid ${C.greyBorder}` : undefined,
              }}
            >
              <h3
                style={{
                  fontFamily:    SANS,
                  fontSize:      "clamp(15px,1.6vw,17px)",
                  fontWeight:    700,
                  letterSpacing: "-0.01em",
                  color:         C.ink,
                  margin:        "0 0 0.65rem",
                }}
              >
                {item.q}
              </h3>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize:   14,
                  color:      C.inkMid,
                  lineHeight: 1.75,
                  margin:     0,
                }}
              >
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════ 9. ORDER FORM (NAVY) */}
      <section
        id="order-form"
        style={{
          background: C.navy,
          padding:    "clamp(5rem,10vh,8rem) clamp(1.5rem,5vw,4rem)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Section header */}
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2
              style={{
                fontFamily:    SANS,
                fontSize:      "clamp(28px,3.5vw,44px)",
                fontWeight:    700,
                letterSpacing: "-0.025em",
                lineHeight:    1.1,
                color:         C.white,
                margin:        "0 0 0.75rem",
              }}
            >
              Get it done today.
            </h2>
            <p
              style={{
                fontFamily: SANS,
                fontSize:   15,
                color:      C.white60,
                margin:     0,
              }}
            >
              Two minutes to fill out. We handle everything from here.
            </p>
          </div>

          {/* Pre-launch state */}
          {!HAS_FORMSPREE ? (
            <div
              style={{
                background:   C.white10,
                border:       `1px solid ${C.white20}`,
                borderRadius: 8,
                padding:      "2.5rem",
                textAlign:    "center",
              }}
            >
              <div
                style={{
                  fontFamily:    SANS,
                  fontSize:      11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color:         C.blue,
                  fontWeight:    600,
                  marginBottom:  "0.75rem",
                }}
              >
                Orders opening soon
              </div>
              <p
                style={{
                  fontFamily:   SANS,
                  fontSize:     20,
                  fontWeight:   700,
                  color:        C.white,
                  margin:       "0 0 0.75rem",
                  letterSpacing:"-0.02em",
                }}
              >
                The order form is almost ready.
              </p>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize:   14,
                  color:      C.white60,
                  lineHeight: 1.7,
                  margin:     "0 0 1.75rem",
                }}
              >
                In the meantime, email us directly and we'll handle your recovery personally.
              </p>
              <a
                href="mailto:hello@heirvo.com"
                style={{
                  display:        "inline-block",
                  background:     C.blue,
                  color:          C.white,
                  fontFamily:     SANS,
                  fontWeight:     600,
                  fontSize:       14,
                  padding:        "0.875rem 1.75rem",
                  borderRadius:   6,
                  textDecoration: "none",
                }}
              >
                hello@heirvo.com
              </a>
            </div>

          ) : submitted ? (
            <div
              style={{
                background:   C.white10,
                border:       `1px solid ${C.blue}`,
                borderRadius: 8,
                padding:      "2.5rem",
                textAlign:    "center",
              }}
            >
              {/* Step indicator */}
              <div
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            "0.4rem",
                  background:     "rgba(10,132,255,0.18)",
                  border:         `1px solid ${C.blue}`,
                  borderRadius:   100,
                  padding:        "0.3rem 0.9rem",
                  fontFamily:     SANS,
                  fontSize:       11,
                  fontWeight:     600,
                  letterSpacing:  "0.14em",
                  textTransform:  "uppercase" as const,
                  color:          C.blue,
                  marginBottom:   "1.25rem",
                }}
              >
                Step 2 of 2
              </div>

              <div
                style={{
                  fontFamily:    SANS,
                  fontSize:      26,
                  fontWeight:    700,
                  color:         C.white,
                  marginBottom:  "0.6rem",
                  letterSpacing: "-0.02em",
                  lineHeight:    1.15,
                }}
              >
                Order details saved.
                <br />
                One more step.
              </div>

              <p
                style={{
                  fontFamily: SANS,
                  fontSize:   15,
                  color:      C.white60,
                  lineHeight: 1.7,
                  margin:     "0 auto 2rem",
                  maxWidth:   "42ch",
                }}
              >
                Pay the <strong style={{ color: C.white }}>$19.99 non-refundable intake fee</strong> to
                confirm your order. This covers our processing and return shipping.
              </p>

              <a
                href={STRIPE_INTAKE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            "0.5rem",
                  background:     C.white,
                  color:          C.navy,
                  fontFamily:     SANS,
                  fontWeight:     700,
                  fontSize:       16,
                  padding:        "0.9rem 2rem",
                  borderRadius:   6,
                  textDecoration: "none",
                  transition:     "opacity 180ms",
                  marginBottom:   "1.5rem",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
              >
                Pay $19.99 intake fee →
              </a>

              <div
                style={{
                  fontFamily: SANS,
                  fontSize:   12,
                  color:      C.white60,
                  lineHeight: 1.6,
                }}
              >
                Once payment clears, we'll email you packing instructions and the closest shipping
                address to you — we route discs to regional drop points (East and West Coast) for the
                fastest possible turnaround. Questions?{" "}
                <a href="mailto:hello@heirvo.com" style={{ color: C.white60, textDecoration: "underline" }}>
                  hello@heirvo.com
                </a>
              </div>
            </div>

          ) : (
            /* Live form */
            <form
              onSubmit={handleSubmit}
              style={{
                display:       "flex",
                flexDirection: "column",
                gap:           "1.5rem",
              }}
            >
              {/* 1. Disc types */}
              <div>
                <label style={{ ...labelStyle }}>
                  What are you sending us?
                </label>
                <div
                  style={{
                    display:  "flex",
                    flexWrap: "wrap",
                    gap:      "0.6rem",
                    marginTop:"0.4rem",
                  }}
                >
                  {[
                    "DVD Video",
                    "Photo CD",
                    "Data CD",
                    "Audio CD",
                    "Blu-ray",
                    "DVD-R/DVD+R",
                    "Other",
                  ].map((type) => (
                    <label
                      key={type}
                      style={{
                        display:     "flex",
                        alignItems:  "center",
                        gap:         "0.45rem",
                        fontFamily:  SANS,
                        fontSize:    13,
                        color:       discTypes.includes(type) ? C.white : C.white60,
                        cursor:      "pointer",
                        padding:     "0.45rem 0.85rem",
                        border:      `1px solid ${discTypes.includes(type) ? C.blue : C.white20}`,
                        borderRadius:4,
                        background:  discTypes.includes(type) ? "rgba(10,132,255,0.18)" : "transparent",
                        transition:  "all 160ms",
                        userSelect:  "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={discTypes.includes(type)}
                        onChange={() => toggleDiscType(type)}
                        style={{ accentColor: C.blue, width: 14, height: 14, flexShrink: 0 }}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Disc quantity + price estimate */}
              <div>
                <label style={labelStyle}>How many discs?</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={discQty}
                  onChange={(e) => setDiscQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...fieldBase, width: 120 }}
                />
                <div
                  style={{
                    marginTop:  "0.5rem",
                    fontFamily: SANS,
                    fontSize:   13,
                    color:      C.blue,
                    fontWeight: 600,
                  }}
                >
                  Estimated total: {priceLabel(discQty, addOnCost)} (incl. $19.99 intake + return shipping)
                </div>
              </div>

              {/* 3. Delivery */}
              <div>
                <label style={labelStyle}>How would you like to receive your files?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.4rem" }}>
                  {([
                    { value: "cloud",  label: "Cloud download link — free" },
                    { value: "usb",    label: "USB drive + cloud — +$19" },
                    { value: "upload", label: "Google Photos / iCloud upload — +$15" },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        "0.6rem",
                        fontFamily: SANS,
                        fontSize:   14,
                        color:      delivery === opt.value ? C.white : C.white60,
                        cursor:     "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="delivery"
                        value={opt.value}
                        checked={delivery === opt.value}
                        onChange={() => setDelivery(opt.value)}
                        style={{ accentColor: C.blue, width: 15, height: 15, flexShrink: 0 }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. Rush */}
              <div>
                <label
                  style={{
                    display:    "flex",
                    alignItems: "center",
                    gap:        "0.6rem",
                    fontFamily: SANS,
                    fontSize:   14,
                    color:      C.white60,
                    cursor:     "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rush}
                    onChange={(e) => setRush(e.target.checked)}
                    style={{ accentColor: C.blue, width: 15, height: 15, flexShrink: 0 }}
                  />
                  <span style={{ color: rush ? C.white : C.white60 }}>
                    Rush processing — +$25 (5 business days)
                  </span>
                </label>
              </div>

              {/* 5. Name */}
              <div>
                <label style={labelStyle} htmlFor="rh-name">Your name</label>
                <input
                  id="rh-name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={fieldBase}
                />
              </div>

              {/* 6. Email */}
              <div>
                <label style={labelStyle} htmlFor="rh-email">Email address</label>
                <input
                  id="rh-email"
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={fieldBase}
                />
              </div>

              {/* 7. Phone (optional) */}
              <div>
                <label style={labelStyle} htmlFor="rh-phone">
                  Phone (optional)
                </label>
                <input
                  id="rh-phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={fieldBase}
                />
                <div
                  style={{
                    marginTop:  "0.4rem",
                    fontFamily: SANS,
                    fontSize:   12,
                    color:      C.white60,
                  }}
                >
                  Only if we have a question about your disc
                </div>
              </div>

              {/* 8. Address */}
              <div>
                <label style={labelStyle} htmlFor="rh-address">Return shipping address</label>
                <textarea
                  id="rh-address"
                  required
                  rows={3}
                  placeholder={"123 Main St\nSpringfield, IL 62701"}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ ...fieldBase, resize: "vertical" }}
                />
              </div>

              {/* 9. Notes */}
              <div>
                <label style={labelStyle} htmlFor="rh-notes">Anything we should know? (optional)</label>
                <textarea
                  id="rh-notes"
                  rows={2}
                  placeholder="e.g. disc has a crack near the edge, previously attempted recovery elsewhere..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ ...fieldBase, resize: "vertical" }}
                />
              </div>

              {/* Submit */}
              <div>
                <button
                  ref={submitBtnRef}
                  type="submit"
                  disabled={busy}
                  style={{
                    width:          "100%",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            "0.5rem",
                    background:     busy ? C.inkMute : C.white,
                    color:          C.navy,
                    fontFamily:     SANS,
                    fontWeight:     700,
                    fontSize:       16,
                    padding:        "1rem",
                    border:         "none",
                    borderRadius:   6,
                    cursor:         busy ? "not-allowed" : "pointer",
                    transition:     "opacity 180ms",
                  }}
                >
                  {busy ? "Sending…" : "Send my order →"}
                </button>

                {/* Trust micro-copy */}
                <div
                  style={{
                    marginTop:  "1rem",
                    fontFamily: SANS,
                    fontSize:   12,
                    color:      C.white60,
                    textAlign:  "center",
                    lineHeight: 1.6,
                  }}
                >
                  🔒 Secure · No recovery, no charge · $19.99 intake fee retained · Your originals always returned · Questions?{" "}
                  <a href="mailto:hello@heirvo.com" style={{ color: C.white60, textDecoration: "underline" }}>
                    hello@heirvo.com
                  </a>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────── 10. FOOTER */}
      <Footer />

    </div>
  );
}
