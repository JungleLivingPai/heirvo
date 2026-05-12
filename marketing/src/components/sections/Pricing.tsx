import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import {
  isLemonSqueezyConfigured,
  openLemonCheckout,
} from "../../lib/lemon-squeezy";

const LS_CHECKOUT_URL =
  import.meta.env.VITE_LS_CHECKOUT_URL ||
  "https://heirvo.lemonsqueezy.com/checkout/buy/replace-me";

const FEATURES: string[] = [
  "Save as MP4 (lossless, instant)",
  "Save as ISO disc image",
  "Extract individual chapters",
  "Recover all files from data CDs",
  "AI restoration (upscale, denoise)",
  "Priority email support",
  "All future updates included",
];

export default function Pricing() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isLemonSqueezyConfigured(LS_CHECKOUT_URL);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      if (!cardRef.current) return;
      gsap.set(cardRef.current, {
        opacity: 0,
        scale: 0.97,
        y: 18,
      });

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && cardRef.current) {
              gsap.to(cardRef.current, {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: 0.9,
                ease: "power3.out",
              });
              observer.disconnect();
            }
          });
        },
        { threshold: 0.18 }
      );
      if (cardRef.current) observer.observe(cardRef.current);

      return () => observer.disconnect();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleBuy = async () => {
    if (!configured || loading) return;
    setLoading(true);
    try {
      await openLemonCheckout(LS_CHECKOUT_URL);
    } finally {
      // Small delay so the button doesn't visually flicker before overlay opens
      setTimeout(() => setLoading(false), 600);
    }
  };

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="relative py-20 sm:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="container-narrow">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-14">
          <div className="micro-label mb-3">Heirvo Pro</div>
          <h2
            id="pricing-heading"
            className="font-display font-bold tracking-tightest text-ink-900"
            style={{ fontSize: "clamp(32px,4.6vw,52px)", lineHeight: 1.04 }}
          >
            $39 one-time. <span className="gradient-text">Yours forever.</span>
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-500">
            No subscription, no upsells. Pay once, unlock saving and AI
            restoration for every disc you ever recover.
          </p>
        </div>

        <div className="relative max-w-xl mx-auto">
          {/* Soft glow halo behind card */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-[36px] blur-3xl opacity-60"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 30%, rgba(10,132,255,0.18), transparent 70%), radial-gradient(50% 50% at 50% 90%, rgba(90,200,250,0.18), transparent 70%)",
            }}
          />

          <div
            ref={cardRef}
            className="relative rounded-[28px] bg-white border border-ink-200/80 p-8 sm:p-10 shadow-glass-lg"
            style={{ willChange: "transform, opacity" }}
          >
            {/* Subtle gradient top border */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px rounded-t-[28px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(10,132,255,0.6) 50%, transparent 100%)",
              }}
            />

            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-gradient-soft border border-brand-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                Heirvo Pro
              </div>
              <div className="text-[12px] text-ink-500">One license</div>
            </div>

            {/* Price */}
            <div className="flex items-end gap-3 mb-1">
              <span
                className="font-display font-bold tabular-nums tracking-tightest gradient-text leading-none"
                style={{ fontSize: "clamp(64px, 9vw, 88px)" }}
              >
                $39
              </span>
              <div className="pb-3">
                <div className="text-[14px] font-medium text-ink-900">
                  one-time
                </div>
                <div className="text-[13px] text-ink-500">no subscription</div>
              </div>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-500">
              Recovery is always free. Pay once when you&rsquo;re ready to save
              what we found.
            </p>

            {/* Divider */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent" />

            {/* Features */}
            <ul className="space-y-3.5 mb-8">
              {FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-[15px] text-ink-700"
                >
                  <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-ios-green/12">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M2.5 6.5L5 9L9.5 3.5"
                        stroke="#34C759"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            {configured ? (
              <button
                type="button"
                onClick={handleBuy}
                disabled={loading}
                aria-label="Buy Heirvo Pro for $39"
                className="btn btn-primary w-full !text-[16px] !py-4 disabled:opacity-70 disabled:cursor-wait"
              >
                {loading ? (
                  <>
                    <Spinner /> Opening checkout&hellip;
                  </>
                ) : (
                  <>
                    Buy Heirvo Pro
                    <ArrowIcon />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Set VITE_LS_CHECKOUT_URL to enable checkout"
                className="btn w-full !text-[16px] !py-4 bg-ink-100 text-ink-500 border border-ink-200 cursor-not-allowed"
              >
                Lemon Squeezy not configured
              </button>
            )}

            {/* Trust micro-copy */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-ink-500">
              <LockIcon />
              <span>Secure checkout via Lemon Squeezy</span>
            </div>

            {/* Already purchased */}
            <p className="mt-6 text-center text-[14px] text-ink-500">
              Already purchased?{" "}
              <Link
                to="/activate"
                className="font-medium text-brand-600 hover:text-brand-700 hover:underline underline-offset-4"
              >
                Activate your key &rarr;
              </Link>
            </p>
          </div>

          {/* Trust badges row */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <TrustBadge icon={<ShieldIcon />} label="Secure checkout" />
            <TrustBadge icon={<BoltIcon />} label="Instant license delivery" />
            <TrustBadge icon={<DevicesIcon />} label="Works on all your PCs" />
          </div>

          {/* Refund / fine print */}
          <p className="mt-6 text-center text-[12.5px] text-ink-400 max-w-md mx-auto leading-relaxed">
            30-day money-back guarantee &mdash; if Heirvo Pro can&rsquo;t produce
            a playable file from your disc, we&rsquo;ll refund you, no
            questions asked.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------ Subcomponents ------------ */

function TrustBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5 rounded-2xl bg-white/60 border border-ink-200/70 backdrop-blur px-4 py-3 text-[13px] text-ink-700">
      <span className="text-brand-600 shrink-0">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

/* ------------ Icons ------------ */

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 00-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="5.5"
        width="7"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M4 5.5V4a2 2 0 014 0v1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5l5.5 2v4.2c0 3.4-2.4 6.2-5.5 6.8-3.1-.6-5.5-3.4-5.5-6.8V3.5L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 8.25L7.25 9.75L10.5 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9 1.5L3 9h4l-1 5.5L13 7H9l1-5.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DevicesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="3"
        width="10"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9.5"
        y="6.5"
        width="5"
        height="7.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="#fff"
      />
    </svg>
  );
}
