import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import {
  isLemonSqueezyConfigured,
  openLemonCheckout,
} from "../lib/lemon-squeezy";

const DOWNLOAD_URL = (import.meta.env.VITE_DOWNLOAD_URL as string) || "";

const LS_CHECKOUT_URL = import.meta.env.VITE_LS_CHECKOUT_URL || "";

/**
 * /download — the dual-path "get started" page.
 *
 * Heirvo is unusual: the hard part (recovery) is free; only saving the
 * recovered video costs money. So this page leads with FREE — same installer,
 * full recovery, no time limit — and frames Pro as an upgrade you do later
 * when you actually have something worth saving.
 *
 * Two stacked panels (not a comparison table — comparisons feel insecure
 * for a one-tier product). Each panel is its own emotional pitch with a
 * single, unambiguous primary action.
 */
export default function Download() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const lsConfigured = isLemonSqueezyConfigured(LS_CHECKOUT_URL);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-reveal]", {
        y: 24,
        opacity: 0,
        duration: 0.85,
        stagger: 0.12,
        ease: "expo.out",
      });
    }, scopeRef);
    return () => ctx.revert();
  }, []);

  const onBuy = async () => {
    if (!lsConfigured) return;
    try {
      await openLemonCheckout(LS_CHECKOUT_URL);
    } catch {
      window.open(LS_CHECKOUT_URL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="relative">
      <Nav />
      <main ref={scopeRef} className="relative">
        <div className="mesh-bg absolute inset-0 -z-10" />

        <div className="container-narrow pt-16 pb-24 sm:pt-20">
          {/* Header */}
          <div className="max-w-2xl mb-14" data-reveal>
            <span className="micro-label">Get Heirvo</span>
            <h1
              className="mt-3 font-display font-bold tracking-tightest text-ink-900"
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              Start free. Pay only when you have something worth saving.
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-500">
              Heirvo recovers any disc for free — no time limit, no watermarks.
              Pro ($39 one-time) unlocks saving the recovered video as MP4, ISO,
              or chapter files, plus AI restoration.
            </p>
          </div>

          {/* Two paths */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* Free panel */}
            <PathCard
              tone="free"
              eyebrow="Start here"
              title="Heirvo Free"
              price="Free forever"
              priceNote="No account, no time limit"
              features={[
                "Recover any DVD or photo CD",
                "Multi-pass sector recovery",
                "Resumable sessions",
                "Patient mode for fragile drives",
                "View what was recovered",
              ]}
              ctaLabel={DOWNLOAD_URL ? "Download for Windows" : "Coming soon"}
              ctaHref={DOWNLOAD_URL || undefined}
              ctaDisabled={!DOWNLOAD_URL}
              ctaSubcopy={
                DOWNLOAD_URL
                  ? "~250 MB · Windows 10 or 11"
                  : "The Windows app is almost ready. No DVD drive? Try our mail-in service below."
              }
              windowsNote={
                DOWNLOAD_URL
                  ? `Windows may show a "Windows protected your PC" warning. Click More info → Run anyway to install. This happens because the app isn't yet code-signed — it's safe.`
                  : undefined
              }
              data-reveal
            />

            {/* Pro panel */}
            <PathCard
              tone="pro"
              eyebrow="When you're ready to save"
              title="Heirvo Pro"
              price="$39"
              priceNote="One-time, no subscription"
              features={[
                "Save as MP4 (lossless)",
                "Save as ISO disc image",
                "Extract individual chapters",
                "Recover all files from data CDs",
                "AI restoration (upscale, denoise)",
                "Priority email support",
                "All future updates included",
              ]}
              ctaLabel={lsConfigured ? "Upgrade to Pro" : "Lemon Squeezy not configured"}
              onCtaClick={lsConfigured ? onBuy : undefined}
              ctaDisabled={!lsConfigured}
              ctaSubcopy={
                lsConfigured
                  ? "Secure checkout via Lemon Squeezy · 30-day refund"
                  : "Set VITE_LS_CHECKOUT_URL in your .env"
              }
              data-reveal
            />
          </div>

          {/* Reassurance line */}
          <div
            className="mt-12 max-w-2xl rounded-2xl border border-ink-200/70 bg-white/70 backdrop-blur p-5 text-[14px] leading-relaxed text-ink-600"
            data-reveal
          >
            <strong className="text-ink-900">Most people start free.</strong>{" "}
            Recover the disc first — it can take hours. If the recovery looks
            good, upgrade to Pro and save it. If the disc was unrecoverable, you
            haven't paid a cent.
          </div>

          {/* No DVD drive alternative */}
          <div
            className="mt-5 max-w-2xl rounded-2xl border border-ink-200/70 bg-white/70 backdrop-blur p-5 text-[14px] leading-relaxed text-ink-600"
            data-reveal
          >
            <strong className="text-ink-900">Don't have a DVD drive?</strong>{" "}
            No problem — use our{" "}
            <Link
              to="/recover"
              className="text-brand-600 hover:text-brand-500 underline-offset-4 hover:underline"
            >
              mail-in recovery service
            </Link>
            . Ship us the disc and we handle everything.
          </div>

          {/* Already purchased */}
          <p className="mt-10 text-center text-[14px] text-ink-500" data-reveal>
            Already purchased?{" "}
            <Link
              to="/activate"
              className="text-brand-600 hover:text-brand-500 underline-offset-4 hover:underline"
            >
              Activate your license →
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- PathCard ---------- */

type PathCardProps = {
  tone: "free" | "pro";
  eyebrow: string;
  title: string;
  price: string;
  priceNote: string;
  features: string[];
  ctaLabel: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  ctaSubcopy?: string;
  windowsNote?: string;
  "data-reveal"?: boolean;
};

function PathCard({
  tone,
  eyebrow,
  title,
  price,
  priceNote,
  features,
  ctaLabel,
  ctaHref,
  onCtaClick,
  ctaDisabled,
  ctaSubcopy,
  windowsNote,
  ...rest
}: PathCardProps) {
  const isPro = tone === "pro";
  return (
    <section
      {...rest}
      className="relative overflow-hidden rounded-3xl border bg-white/80 backdrop-blur p-7 sm:p-8"
      style={{
        borderColor: isPro ? "rgba(10,132,255,0.30)" : "rgba(225,230,238,0.85)",
        boxShadow: isPro
          ? "0 1px 2px rgba(10,23,41,0.05), 0 22px 60px -20px rgba(10,132,255,0.20)"
          : "0 1px 2px rgba(10,23,41,0.04), 0 6px 18px rgba(10,23,41,0.05)",
      }}
    >
      {/* Decorative tone bar */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: isPro
            ? "linear-gradient(90deg, #0A84FF 0%, #5AC8FA 100%)"
            : "linear-gradient(90deg, #34C759 0%, #5AC8FA 100%)",
        }}
      />

      <div
        className="micro-label"
        style={{ color: isPro ? "#0A84FF" : "#1B5E20" }}
      >
        {eyebrow}
      </div>
      <h2 className="mt-2 font-display text-[26px] font-semibold tracking-tightish text-ink-900">
        {title}
      </h2>

      <div className="mt-5 flex items-baseline gap-2">
        <span
          className="font-display text-[40px] font-bold tabular-nums tracking-tightest text-ink-900"
          style={{
            color: isPro ? "#0A84FF" : "#0A1729",
          }}
        >
          {price}
        </span>
      </div>
      <p className="text-[12.5px] text-ink-500">{priceNote}</p>

      <ul className="mt-6 space-y-2.5 text-[14px] text-ink-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon tone={tone} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {ctaHref ? (
          <a
            href={ctaHref}
            className={`btn ${isPro ? "btn-primary" : "btn-primary"} w-full justify-center`}
            style={
              isPro
                ? undefined
                : {
                    background:
                      "linear-gradient(135deg, #34C759 0%, #2EB553 100%)",
                  }
            }
          >
            {ctaLabel}
          </a>
        ) : (
          <button
            onClick={onCtaClick}
            disabled={ctaDisabled}
            className="btn btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            title={ctaDisabled ? ctaSubcopy : undefined}
          >
            {ctaLabel}
          </button>
        )}
        {ctaSubcopy && (
          <p className="mt-2.5 text-center text-[11.5px] text-ink-500">
            {ctaSubcopy}
          </p>
        )}
        {windowsNote && (
          <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <span className="mt-px text-amber-500 shrink-0" aria-hidden>⚠</span>
            <p className="text-[11.5px] leading-relaxed text-amber-800">
              {windowsNote}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function CheckIcon({ tone }: { tone: "free" | "pro" }) {
  const color = tone === "pro" ? "#0A84FF" : "#34C759";
  return (
    <span
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${color}20` }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M2.5 6.2 L4.8 8.4 L9.5 3.5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
