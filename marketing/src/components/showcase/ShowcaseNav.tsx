import { useEffect, useState } from "react";

interface Props {
  onBuy: () => void;
  buyDisabled?: boolean;
  buyLabel: string;
}

export default function ShowcaseNav({ onBuy, buyDisabled, buyLabel }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "backdrop-blur-xl bg-black/55 border-b border-white/[0.06]"
          : "bg-transparent border-b border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 h-16 flex items-center justify-between">
        <a
          href="/"
          className="group inline-flex items-center gap-2.5 select-none"
          aria-label="Heirvo home"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#5AC8FA] to-[#0A84FF] shadow-[0_0_24px_rgba(90,200,250,0.45)]">
            <span className="absolute inset-[3px] rounded-full bg-black" />
            <span className="absolute inset-[6px] rounded-full bg-gradient-to-br from-white/80 to-[#5AC8FA]/30" />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
            Heirvo
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-[13px] text-white/55">
          <a href="#chapter-spin" className="hover:text-white transition-colors">Product</a>
          <a href="#chapter-stack" className="hover:text-white transition-colors">Trust</a>
          <a href="#chapter-price" className="hover:text-white transition-colors">Pricing</a>
        </nav>

        <button
          type="button"
          onClick={onBuy}
          disabled={buyDisabled}
          className={[
            "group relative inline-flex items-center gap-2 rounded-full px-5 py-2",
            "text-[13px] font-medium tracking-[0.01em]",
            "transition-all duration-200",
            buyDisabled
              ? "bg-white/[0.04] text-white/40 cursor-not-allowed border border-white/[0.06]"
              : "bg-white text-black hover:bg-[#E8FBFF] hover:shadow-[0_0_36px_rgba(90,200,250,0.55)]",
          ].join(" ")}
        >
          <span>{buyLabel}</span>
          <span aria-hidden className="text-[13px]">→</span>
        </button>
      </div>
    </header>
  );
}
