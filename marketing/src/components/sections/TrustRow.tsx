import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Item = {
  title: string;
  body: string;
  icon: React.ReactNode;
};

const items: Item[] = [
  {
    title: "Runs entirely on your computer",
    body: "Reads the disc directly from your drive. The recovery never leaves your machine.",
    icon: <ShieldIcon />,
  },
  {
    title: "Never uploads your videos",
    body: "No cloud, no account. Your family memories aren't anyone's training data.",
    icon: <NoUploadIcon />,
  },
  {
    title: "Free to recover",
    body: "Scan, preview and verify everything. You only pay when you're ready to save.",
    icon: <SparkleIcon />,
  },
  {
    title: "$39 once, no subscription",
    body: "Pay once, keep forever. Free updates. Three of your devices, lifetime.",
    icon: <PriceIcon />,
  },
  {
    title: "Works offline",
    body: "Plane, basement, cabin. As long as the disc spins, Heirvo works.",
    icon: <OfflineIcon />,
  },
];

export default function TrustRow() {
  const scopeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-trust-head]", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.06,
        scrollTrigger: { trigger: scopeRef.current, start: "top 78%" },
      });
      gsap.from("[data-trust-item]", {
        opacity: 0,
        y: 28,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.07,
        scrollTrigger: { trigger: scopeRef.current, start: "top 72%" },
      });
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="trust"
      ref={scopeRef}
      className="relative py-24 sm:py-32 overflow-hidden"
    >
      <div className="container-narrow">
        <div className="max-w-3xl mb-12 sm:mb-14">
          <div
            data-trust-head
            className="micro-label mb-4 flex items-center gap-3"
          >
            <span className="h-px w-8 bg-ink-300" />
            Quietly principled
          </div>
          <h2
            data-trust-head
            className="font-display font-bold tracking-tightest text-ink-900"
            style={{ fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.04 }}
          >
            Built for the things that <span className="gradient-text">can't be replaced.</span>
          </h2>
          <p
            data-trust-head
            className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-2xl"
          >
            Heirvo treats your discs the way you would. No uploads, no
            accounts, no nonsense — just patient recovery on your own machine.
          </p>
        </div>

        {/* Editorial row layout: 2 + 3 grid, last item spans wider on desktop */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          {items.map((it, i) => {
            // Layout pattern: 3 cards lg:col-span-2, then 2 cards lg:col-span-3
            const span =
              i < 3 ? "lg:col-span-2" : "lg:col-span-3";
            return (
              <li
                key={it.title}
                data-trust-item
                className={`group relative ${span}`}
              >
                <div className="relative h-full card-solid p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-glass-lg">
                  {/* gradient accent stripe */}
                  <span
                    aria-hidden
                    className="absolute left-7 top-0 h-0.5 w-10 bg-brand-gradient rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient-soft border border-brand-500/20 mb-5">
                    {it.icon}
                  </div>
                  <h3 className="font-display font-semibold text-[16px] sm:text-[17px] text-ink-900 leading-snug">
                    {it.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
                    {it.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* footer line */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-[13px] text-ink-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ios-green" />
            30-day money-back if recovery doesn't produce a playable file
          </span>
          <span className="hidden sm:inline text-ink-300">·</span>
          <span>Windows 10 &amp; 11 · 64-bit</span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Inline icons ---------------- */

const ICON_STROKE = "#0A84FF";

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 2.5l7 2.5v5c0 4.6-3 8.2-7 9.5-4-1.3-7-4.9-7-9.5v-5l7-2.5z"
        stroke={ICON_STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11l2.5 2.5L15 9"
        stroke={ICON_STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoUploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 14V5m0 0L7 9m4-4l4 4M4 17h14"
        stroke={ICON_STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3l16 16"
        stroke="#FF3B30"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6L11 3z"
        stroke={ICON_STROKE}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="rgba(10,132,255,0.08)"
      />
      <path
        d="M17 14l.7 1.8L19.5 16.5l-1.8.7L17 19l-.7-1.8L14.5 16.5l1.8-.7L17 14z"
        stroke={ICON_STROKE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M3 9.5L9.5 3h7a2.5 2.5 0 012.5 2.5v7L12.5 19a2.5 2.5 0 01-3.5 0L3 13a2.5 2.5 0 010-3.5z"
        stroke={ICON_STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="14.5" cy="7.5" r="1.4" fill={ICON_STROKE} />
    </svg>
  );
}

function OfflineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M3 12a9 9 0 0116 0"
        stroke={ICON_STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6 14a6 6 0 0110 0"
        stroke={ICON_STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="11" cy="17" r="1.6" fill={ICON_STROKE} />
      <path
        d="M2.5 2.5l17 17"
        stroke="#FF3B30"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
