import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Disc3, FolderOpen, Activity, ArrowRight, Mail } from "lucide-react";
import { gsap } from "gsap";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ipc } from "@/lib/ipc";
import type { Session } from "@/lib/types";
import { staggerReveal, headingReveal, prefersReducedMotion } from "@/utils/gsap-fx";

export default function Home() {
  const [active, setActive] = useState<Session | null>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bannerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const list = await ipc.listSessions();
        const running = list.find(
          (s) => s.status === "recovering" || s.status === "paused",
        );
        setActive(running ?? null);
      } catch {
        /* ignore until backend ready */
      }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      headingReveal(headingRef.current);
      staggerReveal(scopeRef, "[data-stagger='subhead']", { delay: 0.25, y: 12 });
      // Testimonial reveals just before the tiles so users read claim → proof → action
      staggerReveal(scopeRef, "[data-stagger='quote']", { delay: 0.38, y: 10 });
      // Primary hero tile
      staggerReveal(scopeRef, "[data-stagger='tile']", { delay: 0.52, stagger: 0.09 });
      // Secondary cards stagger in after primary
      staggerReveal(scopeRef, "[data-stagger='secondary']", { delay: 0.62, stagger: 0.07 });
      // Mail-in nudge last — lowest priority
      staggerReveal(scopeRef, "[data-stagger='mailin']", { delay: 0.80, y: 8 });
    }, scopeRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!active || !bannerRef.current) return;
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      bannerRef.current,
      { y: -16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
    );
  }, [active]);

  return (
    <div ref={scopeRef} className="relative">
      <div className="mesh-bg" />
      <div className="relative mx-auto max-w-5xl px-10 pb-8 pt-6">

        {/* ── Active-rescue banner — pinned above everything when a session is live ── */}
        {active && (
          <Link
            ref={bannerRef}
            to={`/session/${active.id}`}
            className="mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(90,200,250,0.08) 100%)",
              borderColor: "rgba(10,132,255,0.25)",
              boxShadow:
                "0 1px 2px rgba(10,23,41,0.06), 0 8px 24px rgba(10,132,255,0.18)",
            }}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
            </span>
            <Activity className="h-5 w-5 shrink-0 text-brand-600" />
            <div className="flex-1">
              <div className="text-[14px] font-medium text-ink-900">
                Saving in progress: {active.disc_label || "Untitled disc"}
              </div>
              <div className="text-[12px] text-ink-500">
                Click to see what we've saved so far
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-brand-600" />
          </Link>
        )}

        {/* ── Header ── */}
        <header className="mb-4">
          <span
            className="eyebrow text-[12px] tracking-[0.18em]"
            data-stagger="subhead"
          >
            For DVDs, photo CDs, music CDs &amp; more
          </span>
          <h1
            ref={headingRef}
            className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-ink-900"
          >
            Let's rescue the memories on your old discs.
          </h1>
          <p
            data-stagger="subhead"
            className="mt-3 max-w-xl text-[16px] leading-[1.55] text-ink-600"
          >
            Heirvo reads your disc as many times as it takes, rescuing every
            photo, video, and song it possibly can. You don't need to know
            anything about computers — just insert the disc and follow the steps.
          </p>
        </header>

        {/* ── PRIMARY CTA: Start a rescue ──────────────────────────────────────
            Design decision: this is a hero button row, not a card.
            Solid brand gradient + explicit "Begin now" pill = unmistakable.
            The visual mass difference (full-width solid blue vs neutral glass
            below) makes the hierarchy legible without any instructional copy.
            Non-technical users don't need to guess — they see one bright button.
        ─────────────────────────────────────────────────────────────────────── */}
        <Link
          to="/wizard"
          data-stagger="tile"
          className="group mb-3 flex items-center gap-5 rounded-2xl px-6 py-5 transition-all duration-200 hover:-translate-y-[3px]"
          style={{
            background: "linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)",
            boxShadow:
              "0 2px 4px rgba(10,23,41,0.10), 0 14px 40px rgba(10,132,255,0.40)",
          }}
          onMouseEnter={(e) => {
            if (prefersReducedMotion()) return;
            gsap.to(e.currentTarget, {
              y: -4,
              duration: 0.35,
              ease: "power2.out",
              boxShadow:
                "0 2px 6px rgba(10,23,41,0.12), 0 24px 56px rgba(10,132,255,0.52)",
            });
          }}
          onMouseLeave={(e) => {
            if (prefersReducedMotion()) return;
            gsap.to(e.currentTarget, {
              y: 0,
              duration: 0.45,
              ease: "power3.out",
              boxShadow:
                "0 2px 4px rgba(10,23,41,0.10), 0 14px 40px rgba(10,132,255,0.40)",
            });
          }}
        >
          {/* Icon in frosted-glass well — large and immediately recognisable */}
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <Disc3 className="h-5 w-5 text-white" />
          </span>

          <div className="flex-1">
            <div className="font-display text-[20px] font-semibold leading-tight tracking-tightish text-white">
              Start a rescue
            </div>
            <div className="mt-0.5 text-[13px] leading-snug text-white/75">
              Insert any disc — DVD, photo CD, music CD, or data disc.
            </div>
          </div>

          {/* Explicit pill CTA — makes affordance obvious to non-technical users
              who might not recognise the entire row as clickable. */}
          <span
            className="hidden shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-semibold text-white transition group-hover:gap-2.5 sm:flex"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            Begin now
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
          {/* Fallback arrow on very narrow widths */}
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80 transition group-hover:translate-x-0.5 sm:hidden" />
        </Link>

        {/* ── SECONDARY cards: Come back / Your rescued discs ──────────────────
            Visually lighter — white/glass, no gradient, no explicit CTA button.
            The number labels (02, 03) reinforce that these are secondary steps.
            Always visible regardless of session history: first-time visitors
            should understand what the app can do in full — they just landed here.
            The muted neutral treatment keeps them from competing with the hero.
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SecondaryCard
            to="/history"
            number="02"
            icon={<FolderOpen className="h-4 w-4" />}
            title="Come back to a disc"
            desc="Pick up where you left off, or start a new rescue from a disc you've already worked on."
            tone="orange"
          />
          <SecondaryCard
            to="/history"
            number="03"
            icon={<FolderOpen className="h-4 w-4" />}
            title="Your rescued discs"
            desc="Browse every disc you've saved. Open one to review files or gently sharpen the picture."
            tone="violet"
          />
        </div>

        {/* ── Mail-in service nudge ─────────────────────────────────────────────
            Lives below the cards — doesn't compete with the primary action, but
            visible before any scroll. A distinct button-like row (not just a link)
            makes it findable at a glance for users who have no disc drive at all.
            Uses openUrl() so the Tauri shell opens the URL in the system browser.
        ─────────────────────────────────────────────────────────────────────── */}
        <button
          type="button"
          data-stagger="mailin"
          onClick={() => openUrl("https://heirvo.com/recover")}
          className="group mt-5 flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5"
          style={{
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(225,230,238,0.85)",
            boxShadow:
              "0 1px 2px rgba(10,23,41,0.04), 0 4px 14px rgba(10,23,41,0.05)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Violet icon well — different enough from the blue hero to read as a
              distinct category ("external service") rather than another nav option */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(175,82,222,0.14) 0%, rgba(175,82,222,0.08) 100%)",
              border: "1px solid rgba(175,82,222,0.22)",
            }}
          >
            <Mail className="h-4 w-4 text-[#AF52DE]" />
          </span>

          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-ink-900">
              No disc drive? We can still help.
            </div>
            <div className="text-[12px] leading-snug text-ink-500">
              Mail us your disc — we'll do the rescue and send your files back safely.
            </div>
          </div>

          <ArrowRight className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-[#AF52DE]" />
        </button>

        {/* ── Testimonial — right below the mail-in nudge ── */}
        <figure
          data-stagger="quote"
          className="mt-5 flex items-start gap-3 rounded-2xl px-5 py-4"
          style={{
            background: "linear-gradient(135deg, rgba(10,132,255,0.06) 0%, rgba(90,200,250,0.04) 100%)",
            border: "1px solid rgba(10,132,255,0.14)",
          }}
        >
          <span
            aria-hidden="true"
            className="select-none font-display text-[2.4rem] leading-none text-brand-400/50"
            style={{ marginTop: "-0.2rem" }}
          >
            &ldquo;
          </span>
          <div>
            <blockquote className="font-display text-[15px] italic leading-[1.55] text-ink-800">
              It read the disc nine times. The ninth pass found my daughter's
              first birthday.
            </blockquote>
            <figcaption className="mt-2 text-[11px] uppercase tracking-[0.16em] text-ink-400">
              — From a recovered family disc
            </figcaption>
          </div>
        </figure>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SecondaryCard
   Horizontal icon + text layout. Lighter visual weight than the hero CTA.
   GSAP hover: lift 3px + soft accent border glow (colour matches the tone).
   The number label gives the pair sequence context without adding visual noise.
───────────────────────────────────────────────────────────────────────────── */
function SecondaryCard({
  to,
  number,
  icon,
  title,
  desc,
  tone = "blue",
}: {
  to: string;
  number: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone?: "blue" | "orange" | "violet";
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const accent =
    tone === "orange"
      ? "#FF9500"
      : tone === "violet"
        ? "#AF52DE"
        : "#0A84FF";

  const glowColor =
    tone === "orange"
      ? "rgba(255,149,0,0.20)"
      : tone === "violet"
        ? "rgba(175,82,222,0.18)"
        : "rgba(10,132,255,0.18)";

  const borderHover =
    tone === "orange"
      ? "rgba(255,149,0,0.28)"
      : tone === "violet"
        ? "rgba(175,82,222,0.28)"
        : "rgba(10,132,255,0.28)";

  const onEnter = () => {
    if (prefersReducedMotion() || !ref.current) return;
    gsap.to(ref.current, {
      y: -3,
      duration: 0.35,
      ease: "power2.out",
      borderColor: borderHover,
      boxShadow: `0 1px 2px rgba(10,23,41,0.05), 0 16px 36px ${glowColor}`,
    });
  };

  const onLeave = () => {
    if (prefersReducedMotion() || !ref.current) return;
    gsap.to(ref.current, {
      y: 0,
      duration: 0.45,
      ease: "power3.out",
      borderColor: "rgba(225,230,238,0.85)",
      boxShadow: "0 1px 2px rgba(10,23,41,0.04), 0 6px 18px rgba(10,23,41,0.05)",
    });
  };

  return (
    <Link
      ref={ref}
      to={to}
      data-stagger="secondary"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group flex items-start gap-4 rounded-2xl bg-white/70 p-5 backdrop-blur"
      style={{
        border: "1px solid rgba(225,230,238,0.85)",
        boxShadow:
          "0 1px 2px rgba(10,23,41,0.04), 0 6px 18px rgba(10,23,41,0.05)",
      }}
    >
      {/* Icon well — accent-tinted background, visible size */}
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </span>

      <div className="flex-1 min-w-0">
        {/* Number label — gives sequence context inside the secondary pair */}
        <span
          className="mb-1 block font-display text-[11px] font-semibold tabular-nums tracking-[0.06em]"
          style={{ color: accent }}
        >
          {number}
        </span>
        <h3 className="font-display text-[15px] font-semibold leading-tight tracking-tightish text-ink-900">
          {title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{desc}</p>
      </div>

      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}
