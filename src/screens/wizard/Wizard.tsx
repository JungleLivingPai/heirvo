import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ipc, events } from "@/lib/ipc";
import type { DriveInfo, DiscInfo } from "@/lib/types";
import {
  Loader2,
  RefreshCw,
  Disc3,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { documentDir, join } from "@tauri-apps/api/path";
import { prefersReducedMotion } from "@/utils/gsap-fx";

/**
 * Single-screen recovery flow — replaces the previous 4-step wizard.
 *
 * Design philosophy (from buyer-journey UX research):
 *   - The user inserted a disc because they want it rescued. That's their
 *     entire mental model. We match it — no step counter, no drive picker
 *     when there's only one drive, no mode picker, no "Read this disc" button.
 *   - Everything is auto-detected the moment a disc shows up. Headline +
 *     subline update in place as state moves: idle → identifying → ready.
 *   - Destination is auto-picked (Documents/Heirvo/<disc-label>) with a
 *     small "Save somewhere else" link for the 1-in-50 who want a different
 *     folder.
 *   - No upfront Standard/Patient choice — recovery always starts Standard,
 *     and the Dashboard already exposes a "Retry failed sectors" button that
 *     runs Patient mode after the first pass finds damage. That's the right
 *     moment to make a choice — when the question is concrete.
 *   - Engineering details (sectors, firmware, type enum) live behind an
 *     "Advanced" expander, collapsed by default forever.
 */

type Phase =
  | "noDrive" // no optical drive plugged in
  | "noDisc" // drive(s) present, no disc inserted
  | "multiDrive" // 2+ drives present, none with a disc — user must pick
  | "identifying" // disc inserted, probing
  | "ready" // disc identified, awaiting user click
  | "unreadable"; // probe failed

export function Wizard() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [pickedDrive, setPickedDrive] = useState<DriveInfo | null>(null);
  const [disc, setDisc] = useState<DiscInfo | null>(null);
  const [outputDir, setOutputDir] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const navigate = useNavigate();

  const scopeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // Initial drive list + live updates as drives are plugged in/out and
  // discs are inserted/ejected.
  useEffect(() => {
    let cancelled = false;
    ipc
      .listDrives()
      .then((d) => {
        if (!cancelled) setDrives(d);
      })
      .catch(() => {});
    const unsub = events.onDrivesChanged((d) => {
      if (!cancelled) setDrives(d);
    });
    return () => {
      cancelled = true;
      unsub.then((fn) => fn());
    };
  }, []);

  // Auto-pick a drive when there's exactly one, OR when one of multiple
  // drives has a disc inserted (clear intent).
  useEffect(() => {
    if (drives.length === 0) {
      setPickedDrive(null);
      return;
    }
    const withMedia = drives.filter((d) => d.has_media);
    if (withMedia.length === 1) {
      setPickedDrive(withMedia[0]);
      return;
    }
    if (drives.length === 1) {
      setPickedDrive(drives[0]);
      return;
    }
    // Multiple drives, none or multiple with media — user must choose.
    // Keep current pick if still valid; otherwise null.
    if (pickedDrive && !drives.some((d) => d.path === pickedDrive.path)) {
      setPickedDrive(null);
    }
  }, [drives, pickedDrive]);

  // Auto-probe the moment the picked drive has a disc.
  useEffect(() => {
    if (!pickedDrive || !pickedDrive.has_media) {
      setDisc(null);
      setError(null);
      return;
    }
    if (disc) return; // already identified
    let cancelled = false;
    setIdentifying(true);
    setError(null);
    (async () => {
      try {
        const info = await ipc.checkDisc(pickedDrive.path);
        if (cancelled) return;
        if (info) {
          setDisc(info);
        } else {
          setError("No readable disc found in this drive.");
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setIdentifying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedDrive, disc]);

  // If the disc is ejected mid-flow, clear our probe results.
  useEffect(() => {
    if (!pickedDrive) return;
    const stillThere = drives.find(
      (d) => d.path === pickedDrive.path && d.has_media,
    );
    if (!stillThere && disc) {
      setDisc(null);
      setError(null);
    }
  }, [drives, pickedDrive, disc]);

  // Auto-pick output folder once we know the disc label.
  useEffect(() => {
    if (!disc) return;
    if (outputDir) return;
    const safeLabel =
      disc.label
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/_+/g, "_")
        .trim() || "Untitled disc";
    (async () => {
      try {
        const docs = await documentDir();
        const path = await join(docs, "Heirvo", safeLabel);
        setOutputDir(path);
      } catch {
        /* leave blank if path resolution fails — user can pick */
      }
    })();
  }, [disc, outputDir]);

  // Animate headline whenever the phase changes.
  const phase: Phase = (() => {
    if (drives.length === 0) return "noDrive";
    if (!pickedDrive) return "multiDrive";
    if (identifying) return "identifying";
    if (error) return "unreadable";
    if (disc) return "ready";
    return "noDisc";
  })();

  useEffect(() => {
    if (!headlineRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      headlineRef.current,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" },
    );
  }, [phase]);

  const browseFolder = async () => {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      title: "Save rescued files to…",
    });
    if (typeof picked === "string") setOutputDir(picked);
  };

  const startRecovery = async () => {
    if (!pickedDrive || !disc || !outputDir) return;
    setStarting(true);
    try {
      const session = await ipc.createSession({
        disc_label: disc.label,
        disc_fingerprint: disc.fingerprint,
        drive_path: pickedDrive.path,
        total_sectors: disc.total_sectors,
        output_dir: outputDir,
        disc_type: disc.disc_type,
      });
      await ipc.startRecovery(session.id);
      navigate(`/session/${session.id}`);
    } catch (e) {
      setError(String(e));
      setStarting(false);
    }
  };

  return (
    <div ref={scopeRef} className="mx-auto max-w-2xl px-8 py-10">
      <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-10 shadow-sm backdrop-blur">
        {phase === "noDrive" && <PhaseNoDrive />}
        {phase === "noDisc" && <PhaseNoDisc drive={pickedDrive} />}
        {phase === "multiDrive" && (
          <PhaseMultiDrive
            drives={drives}
            onPick={setPickedDrive}
          />
        )}
        {phase === "identifying" && <PhaseIdentifying />}
        {phase === "unreadable" && (
          <PhaseUnreadable
            error={error ?? "Unknown"}
            onRetry={() => {
              setError(null);
              setDisc(null);
            }}
          />
        )}
        {phase === "ready" && disc && (
          <PhaseReady
            headingRef={headlineRef}
            disc={disc}
            outputDir={outputDir}
            onBrowse={browseFolder}
            onStart={startRecovery}
            starting={starting}
          />
        )}

        {/* Advanced expander — only shown once a drive is in the mix. */}
        {phase !== "noDrive" && (
          <div className="mt-8 border-t border-ink-200/60 pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between text-[12px] text-ink-400 hover:text-ink-600 transition"
            >
              <span>Advanced</span>
              {advancedOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {advancedOpen && (
              <Advanced
                drives={drives}
                pickedDrive={pickedDrive}
                onPickDrive={setPickedDrive}
                disc={disc}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase components — each is a single calm screen, no progress bar, no steps.
// ─────────────────────────────────────────────────────────────────────────────

function PhaseNoDrive() {
  return (
    <Centered icon={<Disc3 className="h-7 w-7" />}>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
        Ready when you are.
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.55] text-ink-600">
        Plug in your CD or DVD drive — we'll spot it as soon as it's connected.
      </p>
      <p className="mt-2 inline-flex items-center gap-2 text-[13px] text-ink-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Looking for a drive…
      </p>
    </Centered>
  );
}

function PhaseNoDisc({ drive }: { drive: DriveInfo | null }) {
  return (
    <Centered icon={<Disc3 className="h-7 w-7" />}>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
        Slide a disc in.
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.55] text-ink-600">
        {drive
          ? `We're listening on your ${friendlyDriveName(drive)}. Pop in any DVD, CD, photo CD, or data disc — we'll take it from there.`
          : "Pop in any DVD, CD, photo CD, or data disc — we'll take it from there."}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-ink-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Waiting for a disc…
      </p>
    </Centered>
  );
}

function PhaseMultiDrive({
  drives,
  onPick,
}: {
  drives: DriveInfo[];
  onPick: (d: DriveInfo) => void;
}) {
  return (
    <div>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
        Which drive has your disc?
      </h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-ink-600">
        We see more than one drive. Pick the one your disc is in.
      </p>
      <ul className="mt-6 space-y-2">
        {drives.map((d) => (
          <li key={d.path}>
            <button
              type="button"
              onClick={() => onPick(d)}
              className="flex w-full items-center justify-between rounded-2xl border border-ink-200 bg-white p-4 text-left transition hover:border-ink-300 hover:bg-ink-50"
            >
              <div>
                <div className="text-[15px] font-medium text-ink-900">
                  {friendlyDriveName(d)}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-500">
                  Drive {d.letter}
                </div>
              </div>
              {d.has_media ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Disc ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-500">
                  No disc yet
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhaseIdentifying() {
  return (
    <Centered icon={<Disc3 className="h-7 w-7 animate-pulse" />}>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
        Found a disc. Taking a look…
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.55] text-ink-600">
        This usually takes a few seconds. Please don't remove the disc.
      </p>
      <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-ink-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading…
      </p>
    </Centered>
  );
}

function PhaseUnreadable({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
        This disc is having a hard time.
      </h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-ink-600">
        We can see the disc, but we can't read it yet. This sometimes happens
        with older discs or ones with scratches. It's usually not the end of the
        road.
      </p>
      <div className="mt-5 rounded-2xl border border-ink-200/70 bg-ink-50/70 p-5">
        <p className="text-[14px] font-medium text-ink-900">Try this:</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-[1.55] text-ink-700">
          <li>Take the disc out.</li>
          <li>
            Gently wipe it with a soft cloth, from the centre outward (not in
            circles).
          </li>
          <li>Put it back in.</li>
        </ol>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-[15px] font-semibold text-white shadow-glow-blue transition hover:bg-brand-500"
      >
        Try again
        <ArrowRight className="h-4 w-4" />
      </button>
      <details className="mt-4 text-[11px] text-ink-400">
        <summary className="cursor-pointer hover:text-ink-600">
          Technical details
        </summary>
        <pre className="mt-2 overflow-auto rounded-xl bg-ink-50 p-3 text-[10px]">
          {error}
        </pre>
      </details>
    </div>
  );
}

function PhaseReady({
  disc,
  outputDir,
  onBrowse,
  onStart,
  starting,
  headingRef,
}: {
  disc: DiscInfo;
  outputDir: string;
  onBrowse: () => void;
  onStart: () => void;
  starting: boolean;
  headingRef?: React.Ref<HTMLHeadingElement>;
}): JSX.Element {
  const headline = (() => {
      const label = disc.label.trim();
      if (label && label.toLowerCase() !== "untitled disc") {
        return `We found "${label}".`;
      }
      return `We found your ${friendlyDiscKind(disc.disc_type)}.`;
    })();

    const folder = outputDir.replace(/[\\/][^\\/]+[\\/]?$/, "");
    const lastTwo = outputDir
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .slice(-2)
      .join(" › ");

  return (
    <div>
      <h1
        ref={headingRef}
        className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink-900"
      >
        {headline}
      </h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-ink-600">
          {describeDisc(disc)} Nothing on the disc will be changed.
        </p>

        <div className="mt-6 rounded-2xl border border-ink-200/70 bg-ink-50/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] uppercase tracking-[0.14em] text-ink-400">
                Saving to
              </p>
              <p
                className="mt-1 truncate text-[14px] text-ink-700"
                title={outputDir}
              >
                {lastTwo || folder || outputDir || "Documents › Heirvo"}
              </p>
            </div>
            <button
              type="button"
              onClick={onBrowse}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-100 transition"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Change…
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={starting || !outputDir}
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-7 py-3.5 text-[16px] font-semibold text-white shadow-glow-blue transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none"
        >
          {starting && <Loader2 className="h-4 w-4 animate-spin" />}
          {starting ? "Starting…" : "Rescue this disc"}
          {!starting && <ArrowRight className="h-4 w-4" />}
        </button>
      <p className="mt-2 text-[12px] text-ink-500">
        This usually takes 10–40 minutes. You can leave it running.
      </p>
    </div>
  );
}

function Advanced({
  drives,
  pickedDrive,
  onPickDrive,
  disc,
}: {
  drives: DriveInfo[];
  pickedDrive: DriveInfo | null;
  onPickDrive: (d: DriveInfo) => void;
  disc: DiscInfo | null;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await ipc.listDrives();
      // setting through onPickDrive isn't right here; just rely on the
      // event-driven update. Force a list refresh anyway by no-op-ing.
      void next;
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mt-3 space-y-4 text-[12px] text-ink-500">
      {/* Drive picker — only useful if there's more than one. */}
      {drives.length > 1 && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-ink-700">
              Use a different drive
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-[11px] text-ink-400 hover:text-ink-700 transition"
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {drives.map((d) => (
              <button
                key={d.path}
                type="button"
                onClick={() => onPickDrive(d)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left transition",
                  pickedDrive?.path === d.path
                    ? "border-brand-300 bg-brand-50/50"
                    : "border-ink-200 hover:border-ink-300",
                )}
              >
                <span className="text-[13px] text-ink-700">
                  {friendlyDriveName(d)}{" "}
                  <span className="text-ink-400">· Drive {d.letter}</span>
                  {d.firmware && d.firmware.toLowerCase() !== "unknown" && (
                    <span className="text-ink-400">
                      {" · firmware "}
                      {d.firmware}
                    </span>
                  )}
                </span>
                {d.has_media && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600">
                    Disc
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Disc details for the curious. */}
      {disc && (
        <details>
          <summary className="cursor-pointer hover:text-ink-700">
            Disc details
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <dt>Name</dt>
            <dd className="text-ink-700">{disc.label || "Untitled"}</dd>
            <dt>Kind</dt>
            <dd className="text-ink-700">{friendlyDiscKind(disc.disc_type)}</dd>
            <dt>Capacity</dt>
            <dd className="text-ink-700">
              {((disc.total_sectors * disc.sector_size) / 1024 / 1024 / 1024).toFixed(2)} GB
            </dd>
            <dt>Sectors</dt>
            <dd className="font-mono text-ink-700">
              {disc.total_sectors.toLocaleString()}
            </dd>
          </dl>
        </details>
      )}

      <p className="text-[11px] leading-relaxed">
        We always start with the careful-but-quick "Standard" mode. If a few
        spots come back damaged, the next screen will offer to retry just
        those spots with our "Patient" mode — sometimes overnight, but it can
        recover more.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Centered({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600">
        {icon}
      </div>
      {children}
    </div>
  );
}

function friendlyDriveName(d: DriveInfo): string {
  const friendly = [d.vendor, d.model]
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== "unknown")
    .join(" ");
  return friendly || `Drive ${d.letter}`;
}

function friendlyDiscKind(t: string | null | undefined): string {
  switch (t) {
    case "DvdVideo":
      return "movie DVD";
    case "DvdAudio":
      return "music DVD";
    case "DvdRom":
      return "data DVD";
    case "Cd":
      return "CD";
    case "Unknown":
    case null:
    case undefined:
      return "disc";
    default:
      return "disc";
  }
}

function describeDisc(disc: DiscInfo): string {
  const sizeGb =
    (disc.total_sectors * disc.sector_size) / (1024 * 1024 * 1024);
  const minutes = Math.ceil((disc.total_sectors * 0.0034) / 60);
  switch (disc.disc_type) {
    case "DvdVideo":
      return `About ${minutes} minutes of video. We'll save them to your Documents folder as a regular MP4 you can play anywhere.`;
    case "DvdAudio":
      return `About ${sizeGb.toFixed(1)} GB of music. We'll save it to your Documents folder.`;
    case "DvdRom":
      return `About ${sizeGb.toFixed(1)} GB of files — photos, documents, or whatever you backed up. We'll copy them to your Documents folder.`;
    case "Cd":
      return `About ${sizeGb.toFixed(1)} GB of content. We'll save it to your Documents folder.`;
    default:
      return `About ${sizeGb.toFixed(1)} GB of content. We'll save it to your Documents folder.`;
  }
}
