import { useEffect, useRef } from "react";
import { staggerReveal, clipReveal } from "../../lib/gsap-fx";

const DISC_TYPES = [
  {
    icon: "🎬",
    label: "DVD Video",
    desc: "Home movies, recordings, ripped films",
    files: "VOB → MP4, ISO, chapters",
    color: "#0A84FF",
  },
  {
    icon: "📷",
    label: "Photo CD",
    desc: "Prints scanned to disc at the photo lab",
    files: "JPEG, PNG, TIFF, RAW",
    color: "#5AC8FA",
  },
  {
    icon: "💾",
    label: "Data CD / DVD-ROM",
    desc: "Documents, archives, backups, software",
    files: "Any file type via ISO 9660",
    color: "#34C759",
  },
  {
    icon: "🎵",
    label: "Audio CD",
    desc: "Music albums, home recordings, mix CDs",
    files: "WAV tracks, full rip",
    color: "#FF9500",
  },
  {
    icon: "💿",
    label: "Blu-ray",
    desc: "HD home movies and archival discs",
    files: "M2TS, ISO",
    color: "#AF52DE",
  },
  {
    icon: "📀",
    label: "DVD Audio / DVD-R",
    desc: "Burned discs, finalized recordings",
    files: "VOB, MP4, ISO",
    color: "#FF2D55",
  },
];

const WHAT_WE_SAVE = [
  { label: "Videos", detail: "MP4, VOB, M2TS, AVI" },
  { label: "Photos", detail: "JPEG, PNG, TIFF, RAW" },
  { label: "Music", detail: "WAV, FLAC, MP3" },
  { label: "Documents", detail: "PDF, DOC, XLS, ZIP" },
  { label: "Disc images", detail: "ISO (bit-perfect copy)" },
  { label: "Any file", detail: "If it's on the disc, we try" },
];

export default function SupportedMedia() {
  const scopeRef = useRef<HTMLElement>(null);
  const headRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const killClip  = clipReveal(headRef.current, { direction: "up", duration: 0.8 });
    const killCards = staggerReveal(scopeRef.current, "[data-media-card]", { stagger: 0.07, y: 40 });
    const killFiles = staggerReveal(scopeRef.current, "[data-file-chip]", { stagger: 0.05, y: 20 });
    return () => { killClip(); killCards(); killFiles(); };
  }, []);

  return (
    <section
      id="supported-media"
      ref={scopeRef}
      className="relative py-24 sm:py-32 bg-[#F8F9FC]"
    >
      <div className="container-narrow">

        {/* Header */}
        <div ref={headRef} className="max-w-3xl">
          <div className="micro-label mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-ink-300" />
            Supported media
          </div>
          <h2
            className="font-display font-bold tracking-tightest text-ink-900"
            style={{ fontSize: "clamp(30px, 4.5vw, 52px)", lineHeight: 1.06 }}
          >
            One tool. Every disc type.
          </h2>
          <p className="mt-5 text-[17px] sm:text-[18px] leading-relaxed text-ink-500 max-w-2xl">
            Whether it's a wedding DVD from 2003, a photo CD from the one-hour
            photo lab, or a Blu-ray that won't read — Heirvo handles all of
            them with the same sector-by-sector engine.
          </p>
        </div>

        {/* Disc type cards */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISC_TYPES.map((d) => (
            <div
              key={d.label}
              data-media-card
              className="rounded-2xl bg-white border border-ink-200/70 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <span className="text-[28px] leading-none select-none">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-display font-semibold text-[16px] text-ink-900"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {d.label}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                    {d.desc}
                  </p>
                  <div
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: `${d.color}18`,
                      color: d.color,
                      border: `1px solid ${d.color}30`,
                    }}
                  >
                    {d.files}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* What we save */}
        <div className="mt-16 rounded-3xl bg-white border border-ink-200/70 p-8 sm:p-10 shadow-sm">
          <div className="mb-6">
            <h3
              className="font-display font-semibold text-ink-900"
              style={{ fontSize: "clamp(20px, 2.5vw, 26px)", letterSpacing: "-0.02em" }}
            >
              What Heirvo can rescue
            </h3>
            <p className="mt-2 text-[14px] text-ink-500">
              We recover whatever is on the disc — not just video.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {WHAT_WE_SAVE.map((f) => (
              <div
                key={f.label}
                data-file-chip
                className="flex flex-col gap-0.5 rounded-xl bg-[#F4F6FA] px-4 py-3.5"
              >
                <span className="font-display font-semibold text-[14px] text-ink-800">
                  {f.label}
                </span>
                <span className="text-[11px] text-ink-400 tabular-nums">
                  {f.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ-style bottom note for AIO */}
        <div className="mt-10 space-y-3 text-[14px] text-ink-500 max-w-2xl">
          <p>
            <strong className="text-ink-700">Can Heirvo recover photos from a photo CD?</strong>{" "}
            Yes. Photo CDs store images in JPEG or TIFF format on an ISO 9660
            filesystem. Heirvo reads the filesystem sector by sector and
            extracts every image file, even from discs with surface scratches.
          </p>
          <p>
            <strong className="text-ink-700">What about audio CDs with music recordings?</strong>{" "}
            Yes. Heirvo extracts each audio track as a WAV file using direct
            CD-DA sector reads, bypassing the consumer audio stack that
            typically fails on damaged discs.
          </p>
          <p>
            <strong className="text-ink-700">Can it recover documents and files from a data CD?</strong>{" "}
            Yes. Any file stored on a data CD or DVD-ROM — PDFs, Word documents,
            ZIP archives, software installers — is recovered via the same
            sector-by-sector engine.
          </p>
        </div>

      </div>
    </section>
  );
}
