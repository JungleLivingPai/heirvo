import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Step = {
  n: string;
  kicker: string;
  title: string;
  body: string;
  illustration: React.ReactNode;
};

const steps: Step[] = [
  {
    n: "01",
    kicker: "Insert the disc",
    title: "Heirvo reads what other apps can't.",
    body: "Drop in a disc that won't mount, freezes the player, or shows nothing but errors. Heirvo speaks directly to the drive — no consumer software in the way — and starts mapping every readable sector.",
    illustration: <DiscIllustration />,
  },
  {
    n: "02",
    kicker: "It works through damage",
    title: "Patient, multi-pass recovery. It never gives up.",
    body: "Sector-by-sector reads with drive-friendly pacing. When a sector fights back, Heirvo retries from the other side, slows down, and waits. Bus-powered drives stay alive. Overnight runs finish.",
    illustration: <PassesIllustration />,
  },
  {
    n: "03",
    kicker: "You get the video back",
    title: "Save it as MP4, ISO, or chapter-by-chapter.",
    body: "Choose the format that fits the moment — a shareable MP4 for the family group, a perfect ISO for the archive, or each chapter as its own file. AI restoration is one click away when you want it.",
    illustration: <FormatsIllustration />,
  },
];

export default function HowItWorks() {
  const scopeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>("[data-how-row]");
      rows.forEach((row) => {
        const num = row.querySelector("[data-how-num]");
        const text = row.querySelectorAll("[data-how-text]");
        const art = row.querySelector("[data-how-art]");
        const line = row.querySelector("[data-how-line]");

        gsap.from(num, {
          opacity: 0,
          y: 32,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: row, start: "top 78%" },
        });
        gsap.from(text, {
          opacity: 0,
          y: 24,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: row, start: "top 78%" },
        });
        if (art) {
          gsap.from(art, {
            opacity: 0,
            y: 40,
            scale: 0.96,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: row, start: "top 78%" },
          });
        }
        if (line) {
          gsap.fromTo(
            line,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: 1.4,
              ease: "power2.out",
              transformOrigin: "top center",
              scrollTrigger: { trigger: row, start: "top 75%" },
            },
          );
        }
      });
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="how"
      ref={scopeRef}
      className="relative py-24 sm:py-32 overflow-hidden"
    >
      {/* faint grid backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(10,23,41,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(10,23,41,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse at 50% 35%, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 35%, black 40%, transparent 80%)",
        }}
      />

      <div className="container-narrow relative">
        {/* Section header */}
        <div className="max-w-3xl">
          <div className="micro-label mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-ink-300" />
            How it works
          </div>
          <h2
            className="font-display font-bold tracking-tightest text-ink-900"
            style={{ fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.04 }}
          >
            Three steps. <span className="gradient-text">No drama.</span>
          </h2>
          <p className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-2xl">
            From a stuck disc to a saved file — the whole journey, told the way
            it actually unfolds on your computer.
          </p>
        </div>

        {/* Steps */}
        <ol className="mt-20 sm:mt-24 space-y-24 sm:space-y-32">
          {steps.map((s, i) => {
            const reversed = i % 2 === 1;
            return (
              <li
                key={s.n}
                data-how-row
                className="relative grid lg:grid-cols-12 gap-10 lg:gap-16 items-center"
              >
                {/* connecting vertical line (between steps) */}
                {i < steps.length - 1 && (
                  <span
                    data-how-line
                    aria-hidden
                    className="hidden lg:block absolute left-[5.25rem] top-full h-24 w-px bg-gradient-to-b from-brand-500/40 to-transparent"
                  />
                )}

                {/* Number + text column */}
                <div
                  className={`lg:col-span-6 ${
                    reversed ? "lg:order-2" : ""
                  }`}
                >
                  <div className="flex items-start gap-5 sm:gap-7">
                    <div
                      data-how-num
                      className="font-display font-bold leading-none tracking-tightest tabular-nums select-none"
                      style={{
                        fontSize: "clamp(64px, 9vw, 120px)",
                        background:
                          "linear-gradient(160deg, #0A84FF 0%, #5AC8FA 60%, rgba(90,200,250,0.25) 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }}
                    >
                      {s.n}
                    </div>
                    <div className="pt-2 sm:pt-4 flex-1 min-w-0">
                      <div
                        data-how-text
                        className="micro-label mb-3"
                        style={{ color: "#0066CC" }}
                      >
                        {s.kicker}
                      </div>
                      <h3
                        data-how-text
                        className="font-display font-semibold text-ink-900"
                        style={{
                          fontSize: "clamp(22px, 2.4vw, 30px)",
                          lineHeight: 1.18,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {s.title}
                      </h3>
                      <p
                        data-how-text
                        className="mt-4 text-[16px] sm:text-[17px] leading-[1.7] text-ink-500 max-w-[44ch]"
                      >
                        {s.body}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Illustration column */}
                <div
                  data-how-art
                  className={`lg:col-span-6 ${
                    reversed ? "lg:order-1" : ""
                  }`}
                >
                  <div className="relative">
                    <div className="absolute -inset-6 rounded-[36px] bg-brand-gradient-soft blur-2xl opacity-60" />
                    <div className="card-solid relative p-8 sm:p-10 overflow-hidden">
                      {s.illustration}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Closing note — Patient mode */}
        <div className="mt-24 max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/70 backdrop-blur px-4 py-1.5 text-[12px] text-ink-600"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Patient mode
          </div>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-600 italic">
            For the worst-case discs, Patient mode reads gently overnight and
            often returns what every other tool gave up on.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Illustrations ---------- */

function DiscIllustration() {
  return (
    <svg
      viewBox="0 0 360 240"
      className="w-full h-auto"
      role="img"
      aria-label="A damaged disc being read"
    >
      <defs>
        <linearGradient id="howDisc" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#5AC8FA" />
        </linearGradient>
        <radialGradient id="howShine" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Tray slot */}
      <rect
        x="20"
        y="170"
        width="320"
        height="14"
        rx="3"
        fill="#0A1729"
        opacity="0.08"
      />
      <rect x="20" y="170" width="320" height="3" rx="1.5" fill="#0A1729" opacity="0.18" />

      {/* Disc */}
      <g transform="translate(180 110)">
        <circle r="92" fill="url(#howDisc)" />
        <circle r="92" fill="url(#howShine)" />
        {/* Concentric grooves */}
        {[80, 70, 60, 50, 40].map((r) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="0.6"
          />
        ))}
        {/* Center hole */}
        <circle r="22" fill="#F4F6FA" />
        <circle r="8" fill="#0A1729" opacity="0.35" />
        {/* Scratches */}
        <path
          d="M -75 -10 Q -30 -55 40 -25"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M -55 35 Q 0 60 70 30"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="0.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 20 -65 Q 55 -40 75 -10"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Reading beam */}
      <g opacity="0.85">
        <line
          x1="180"
          y1="20"
          x2="180"
          y2="100"
          stroke="#0A84FF"
          strokeWidth="1.4"
          strokeDasharray="2 4"
        />
        <circle cx="180" cy="20" r="3" fill="#0A84FF" />
      </g>
    </svg>
  );
}

function PassesIllustration() {
  // Stylised disc-map: a grid of cells, some recovered, some retried, some pending
  const cols = 18;
  const rows = 9;
  const total = cols * rows;
  const states: Array<"ok" | "retry" | "pending" | "bad"> = Array.from(
    { length: total },
    (_, i) => {
      // deterministic pseudo pattern
      const x = i % cols;
      const y = Math.floor(i / cols);
      const noise = (x * 7 + y * 13 + ((x * y) % 5)) % 23;
      if (noise < 13) return "ok";
      if (noise < 17) return "retry";
      if (noise < 20) return "bad";
      return "pending";
    },
  );

  const colorFor = (s: string) => {
    switch (s) {
      case "ok":
        return "#0A84FF";
      case "retry":
        return "#5AC8FA";
      case "bad":
        return "#FF9500";
      default:
        return "#E1E6EE";
    }
  };

  const cellW = 16;
  const cellH = 16;
  const gap = 3;
  const w = cols * (cellW + gap) - gap;
  const h = rows * (cellH + gap) - gap;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h + 40}`}
        className="w-full h-auto"
        role="img"
        aria-label="Live disc map showing recovered and retried sectors"
      >
        {states.map((s, i) => {
          const x = (i % cols) * (cellW + gap);
          const y = Math.floor(i / cols) * (cellH + gap);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={cellW}
              height={cellH}
              rx="2"
              fill={colorFor(s)}
              opacity={s === "pending" ? 0.5 : s === "ok" ? 0.95 : 0.85}
            />
          );
        })}
        {/* progress bar */}
        <rect
          x="0"
          y={h + 20}
          width={w}
          height="6"
          rx="3"
          fill="#E1E6EE"
        />
        <rect
          x="0"
          y={h + 20}
          width={w * 0.72}
          height="6"
          rx="3"
          fill="url(#barFill)"
        />
        <defs>
          <linearGradient id="barFill" x1="0" x2="1">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#5AC8FA" />
          </linearGradient>
        </defs>
      </svg>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-500">
        <Legend color="#0A84FF" label="Recovered" />
        <Legend color="#5AC8FA" label="Retried" />
        <Legend color="#FF9500" label="Hard read" />
        <Legend color="#E1E6EE" label="Pending" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function FormatsIllustration() {
  const formats = [
    {
      tag: "MP4",
      title: "Share with everyone",
      sub: "1.4 GB · H.264",
      tint: "from-brand-500 to-brand-400",
    },
    {
      tag: "ISO",
      title: "Exact archival copy",
      sub: "4.3 GB · bit-perfect",
      tint: "from-brand-700 to-brand-500",
    },
    {
      tag: "CHAPTERS",
      title: "Each scene, its own file",
      sub: "12 files · M2V",
      tint: "from-brand-400 to-brand-300",
    },
  ];
  return (
    <div className="space-y-3">
      {formats.map((f) => (
        <div
          key={f.tag}
          className="flex items-center gap-4 rounded-2xl border border-ink-200 bg-white/60 backdrop-blur px-4 py-3.5"
        >
          <div
            className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${f.tint} flex items-center justify-center text-white font-display font-semibold text-[11px] tracking-wider`}
          >
            {f.tag}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-[15px] text-ink-900 truncate">
              {f.title}
            </div>
            <div className="text-[12px] text-ink-500 tabular-nums">
              {f.sub}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path
              d="M9 2v10m0 0L5 8m4 4l4-4M3 15h12"
              stroke="#0A84FF"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1 pl-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient-soft border border-brand-500/20 px-2.5 py-1 text-[11px] font-medium text-brand-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          AI restoration optional
        </span>
        <span className="text-[12px] text-ink-500">one click, when you want it</span>
      </div>
    </div>
  );
}
