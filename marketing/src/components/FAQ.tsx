import { useState } from "react";

interface QA { q: string; a: string; }

const ITEMS: QA[] = [
  {
    q: "Will this work on my disc?",
    a: "Yes for almost everything you'd burn at home — wedding videos, vacation DVDs, photo CDs, document archives, and audio CDs. The only thing Heirvo can't help with is commercial copy-protected discs (store-bought movies). If your disc plays partially, skips, or shows errors, Heirvo can usually save what's still readable.",
  },
  {
    q: "What if my disc is too damaged?",
    a: "Try Patient mode. Heirvo reads gently, sector-by-sector, and is designed to run overnight without your USB drive disconnecting. Combined with a powered USB drive (not bus-powered), Patient mode often recovers discs that other software gives up on within minutes.",
  },
  {
    q: "Is my data uploaded anywhere?",
    a: "No. Everything runs on your computer. Your videos, photos, and files never leave your machine. We never see your memories. AI restoration runs locally — no cloud, no account required to recover.",
  },
  {
    q: "Mac or Linux?",
    a: "Windows only at v1. We picked Windows first because that's where most damaged DVDs and old USB drives live. macOS is on the roadmap.",
  },
  {
    q: "Can I use this on my mom's old computer?",
    a: "Yes. Heirvo runs on Windows 10 and 11 with modest specs — 4 GB of RAM and a USB disc drive (CD or DVD) is enough for recovery. AI restoration is faster on newer machines but works on older ones too.",
  },
  {
    q: "What's the file output?",
    a: "Whatever you need. MP4 plays everywhere (TVs, phones, YouTube). ISO is a perfect digital copy you can burn to a fresh disc. Or save individual files (great for photo CDs and documents). Pro unlocks all formats plus AI restoration.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="card-solid overflow-hidden transition-all"
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-6 text-left px-6 py-5 hover:bg-ink-50/40 transition"
              aria-expanded={isOpen}
            >
              <span className="font-display font-semibold text-[16px] text-ink-900">
                {item.q}
              </span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                  isOpen
                    ? "bg-brand-gradient border-transparent text-white rotate-45"
                    : "border-ink-200 text-ink-500"
                }`}
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-500">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
