import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Disc3, FolderOpen, Sparkles, Activity, ArrowRight } from "lucide-react";
import { gsap } from "gsap";
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
      staggerReveal(scopeRef, "[data-stagger='tile']", { delay: 0.4, stagger: 0.09 });
      staggerReveal(scopeRef, "[data-stagger='quote']", { delay: 0.9, y: 8 });
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
      <div className="relative mx-auto max-w-5xl px-10 pb-6 pt-6">
        <header className="mb-6">
          <span className="eyebrow" data-stagger="subhead">
            For the discs that won't play anymore
          </span>
          <h1
            ref={headingRef}
            className="mt-2 font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] text-ink-900"
          >
            Rescue your home video DVDs.
          </h1>
          <p
            data-stagger="subhead"
            className="mt-2 max-w-xl text-[14px] leading-[1.55] text-ink-500"
          >
            Even when a disc is too damaged to play, we'll quietly read what's
            still readable, fill in what we can, and never lose a frame of
            progress along the way.
          </p>
        </header>

        {active && (
          <Link
            ref={bannerRef}
            to={`/session/${active.id}`}
            className="mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(90,200,250,0.08) 100%)",
              borderColor: "rgba(10,132,255,0.25)",
              boxShadow:
                "0 1px 2px rgba(10,23,41,0.06), 0 8px 24px rgba(10,132,255,0.18)",
            }}
          >
            <span className="relative flex h-2.5 w-2.5">
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

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Chapter
            to="/wizard"
            number="01"
            tone="blue"
            icon={<Disc3 className="h-4 w-4" />}
            title="Rescue a disc"
            desc="Insert a damaged DVD. We'll walk you through saving as much as we can."
          />
          <Chapter
            to="/history"
            number="02"
            tone="orange"
            icon={<FolderOpen className="h-4 w-4" />}
            title="Continue or revisit"
            desc="Pick up a paused rescue, or save another copy from one you finished."
          />
          <Chapter
            to="/enhance"
            number="03"
            tone="violet"
            icon={<Sparkles className="h-4 w-4" />}
            title="Enhance video"
            desc="Make old footage clearer with conservative AI cleanup. Always optional."
          />
        </div>

        <figure
          data-stagger="quote"
          className="mt-6 max-w-2xl border-l-2 border-brand-500/40 pl-5"
        >
          <blockquote className="font-display text-[15px] italic leading-[1.5] text-ink-700">
            "It read the disc nine times. The ninth pass found my daughter's
            first birthday."
          </blockquote>
          <figcaption className="mt-2 text-[11px] uppercase tracking-[0.16em] text-ink-400">
            — From a recovered family disc
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

function Chapter({
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

  const onEnter = () => {
    if (prefersReducedMotion() || !ref.current) return;
    gsap.to(ref.current, {
      y: -3,
      duration: 0.35,
      ease: "power2.out",
      borderColor: "rgba(10,132,255,0.35)",
      boxShadow:
        "0 1px 2px rgba(10,23,41,0.05), 0 18px 38px rgba(10,132,255,0.14)",
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

  const accent =
    tone === "orange"
      ? "#FF9500"
      : tone === "violet"
        ? "#AF52DE"
        : "#0A84FF";

  return (
    <Link
      ref={ref}
      to={to}
      data-stagger="tile"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group block rounded-2xl bg-white/70 p-5 backdrop-blur transition-colors"
      style={{
        border: "1px solid rgba(225,230,238,0.85)",
        boxShadow: "0 1px 2px rgba(10,23,41,0.04), 0 6px 18px rgba(10,23,41,0.05)",
        minHeight: 150,
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="font-display text-[13px] font-semibold tabular-nums tracking-[0.05em]"
          style={{ color: accent }}
        >
          {number}
        </span>
        <span className="text-ink-300 transition group-hover:text-ink-500">
          {icon}
        </span>
      </div>
      <h3 className="mt-4 font-display text-[18px] font-semibold leading-tight tracking-tightish text-ink-900">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{desc}</p>
      <div
        className="mt-3 flex items-center gap-1.5 text-[12px] font-medium opacity-0 transition group-hover:opacity-100"
        style={{ color: accent }}
      >
        Open
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
