import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { BrandMark } from "../components/BrandMark";

const SUPPORT_EMAIL = "support@heirvo.com";

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Check your email for the license key",
    body: "We sent it the moment your payment cleared. If you can't see it, check your spam folder for a message from Lemon Squeezy.",
  },
  {
    n: "02",
    title: "Open Heirvo on your computer",
    body: "Launch the app and head to Settings. If you haven't installed it yet, the welcome email contains your download link.",
  },
  {
    n: "03",
    title: "Paste your key, click Activate",
    body: "That's it. Saving, AI restoration, and every Pro feature unlock instantly &mdash; on this device and any other PC you use.",
  },
];

export default function Activate() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-reveal='hero']", {
        opacity: 0,
        y: 14,
        duration: 0.8,
        ease: "power3.out",
      });
      gsap.from("[data-reveal='mark']", {
        opacity: 0,
        scale: 0.92,
        duration: 1.0,
        ease: "power3.out",
        delay: 0.05,
      });
      gsap.from("[data-reveal='step']", {
        opacity: 0,
        y: 16,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.25,
      });
      gsap.from("[data-reveal='aside']", {
        opacity: 0,
        y: 12,
        duration: 0.7,
        ease: "power3.out",
        delay: 0.7,
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="relative min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 relative">
        <div className="mesh-bg" />

        <div className="container-narrow relative py-16 sm:py-24 max-w-3xl">
          {/* Hero */}
          <div className="text-center mb-12 sm:mb-16" data-reveal="hero">
            <div className="inline-flex items-center gap-2 rounded-full bg-ios-green/10 text-ios-green px-3 py-1.5 mb-6 text-[12px] font-medium">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 6.5L4.5 9L10 3.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Payment received &mdash; thank you
            </div>

            <div
              className="mx-auto mb-7 flex justify-center"
              data-reveal="mark"
            >
              <div
                className="relative inline-flex items-center justify-center"
                style={{ width: 96, height: 96 }}
                aria-hidden
              >
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-60"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(10,132,255,0.45), transparent 65%)",
                  }}
                />
                <div className="relative opacity-90">
                  <BrandMark size={72} />
                </div>
              </div>
            </div>

            <h1
              className="font-display font-bold tracking-tightest text-ink-900"
              style={{ fontSize: "clamp(36px, 5.5vw, 56px)", lineHeight: 1.04 }}
            >
              Welcome to <span className="gradient-text">Heirvo Pro.</span>
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-500 max-w-xl mx-auto">
              Your memories are about to become permanent again. Three small
              steps and you&rsquo;re saving discs.
            </p>
          </div>

          {/* Steps */}
          <ol className="space-y-4 mb-12">
            {STEPS.map((step) => (
              <li
                key={step.n}
                data-reveal="step"
                className="card-solid p-6 sm:p-7 flex gap-5 sm:gap-6 items-start"
              >
                <div
                  className="font-display font-bold tabular-nums tracking-tightest gradient-text leading-none shrink-0"
                  style={{ fontSize: "clamp(32px, 4vw, 40px)" }}
                >
                  {step.n}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-[17px] sm:text-[18px] text-ink-900 mb-1.5">
                    {step.title}
                  </h3>
                  <p
                    className="text-[14.5px] leading-relaxed text-ink-500"
                    dangerouslySetInnerHTML={{ __html: step.body }}
                  />
                </div>
              </li>
            ))}
          </ol>

          {/* Aside / help */}
          <div data-reveal="aside" className="card p-6 sm:p-7 text-center">
            <h3 className="font-display font-semibold text-[16px] text-ink-900 mb-1.5">
              Need a hand?
            </h3>
            <p className="text-[14px] leading-relaxed text-ink-500 mb-4 max-w-md mx-auto">
              If anything looks off &mdash; missing email, key won&rsquo;t
              activate, anything &mdash; we read every message and reply
              within a few hours.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-brand-600 hover:text-brand-700 hover:underline underline-offset-4"
            >
              <MailIcon />
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/"
              className="text-[14px] text-ink-500 hover:text-ink-900 transition"
            >
              &larr; Back to home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="3"
        width="11"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2 4l5 4 5-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
