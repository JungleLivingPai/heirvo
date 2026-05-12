import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ipc, events } from "@/lib/ipc";
import type { DriveInfo, DiscInfo, StorageDrive } from "@/lib/types";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
  HardDrive,
  Usb,
  FolderOpen,
  Disc3,
  Check,
  Shield,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { documentDir, join } from "@tauri-apps/api/path";
import { prefersReducedMotion } from "@/utils/gsap-fx";

type Step = 0 | 1 | 2 | 3;

const STEP_TITLES = [
  { eyebrow: "Step one", title: "Choose a drive", subtitle: "We'll listen for your disc.", next: "Pick the disc" },
  { eyebrow: "Step two", title: "Read the disc", subtitle: "A quick look at what's on it.", next: "Pick a destination" },
  { eyebrow: "Step three", title: "Pick a destination", subtitle: "Where the rescued files will land.", next: "Begin the rescue" },
  { eyebrow: "Step four", title: "Begin the rescue", subtitle: "Two ways to read — your call.", next: "" },
];

export function Wizard() {
  const [step, setStep] = useState<Step>(0);
  const [drive, setDrive] = useState<DriveInfo | null>(null);
  const [disc, setDisc] = useState<DiscInfo | null>(null);
  const [outputDir, setOutputDir] = useState("");
  const [mode, setMode] = useState<"standard" | "patient">("standard");
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);

  const next = () => setStep((s) => Math.min(3, s + 1) as Step);
  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  useEffect(() => {
    const unsub = events.onDrivesChanged((d) => {
      if (drive) {
        const updated = d.find((x) => x.path === drive.path);
        if (updated && updated.has_media !== drive.has_media) {
          setDrive(updated);
          if (step === 0 && updated.has_media) {
            setStep(1);
          }
        }
      }
    });
    return () => {
      unsub.then((fn) => fn());
    };
  }, [drive, step]);

  // Page-turn animation between steps
  useEffect(() => {
    if (!pageRef.current) return;
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      pageRef.current,
      { x: 24, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
    );
  }, [step]);

  const startRecovery = async () => {
    if (!drive || !disc || !outputDir) return;
    const session = await ipc.createSession({
      disc_label: disc.label,
      disc_fingerprint: disc.fingerprint,
      drive_path: drive.path,
      total_sectors: disc.total_sectors,
      output_dir: outputDir,
      disc_type: disc.disc_type,
    });
    await ipc.startRecovery(session.id);
    navigate(`/session/${session.id}`);
  };

  useEffect(() => {
    if (!disc || outputDir) return;
    const safeLabel =
      disc.label
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/_+/g, "_")
        .trim() || "Untitled disc";
    (async () => {
      try {
        const docs = await documentDir();
        const path = await join(docs, "DVD Rescue", safeLabel);
        setOutputDir(path);
      } catch {
        /* fall back */
      }
    })();
  }, [disc, outputDir]);

  const meta = STEP_TITLES[step];

  return (
    <div className="mx-auto max-w-3xl px-10 py-5">
      <ProgressLine current={step} />

      <div ref={pageRef} className="mt-4">
        <div className="mb-4 px-1">
          <span className="eyebrow">{meta.eyebrow}</span>
          <h2 className="mt-1 font-display text-[20px] font-semibold leading-tight tracking-[-0.025em] text-ink-900">
            {meta.title}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            {meta.subtitle}
          </p>
        </div>

        <div className="chapter">
          {step === 0 && <Step1 drive={drive} setDrive={setDrive} />}
          {step === 1 && (
            <Step2
              drive={drive}
              disc={disc}
              setDisc={(d) => {
                setDisc(d);
                setStep(2);
              }}
            />
          )}
          {step === 2 && <Step3 outputDir={outputDir} setOutputDir={setOutputDir} disc={disc} />}
          {step === 3 && (
            <StartStep
              disc={disc}
              mode={mode}
              setMode={setMode}
              onStart={startRecovery}
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          className="btn btn-ghost"
          disabled={step === 0}
          onClick={back}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 3 ? (
          <div className="flex flex-col items-end gap-1">
            <button
              className="btn btn-primary"
              onClick={next}
              disabled={
                (step === 0 && !drive) ||
                (step === 1 && !disc) ||
                (step === 2 && !outputDir)
              }
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
            {meta.next && (
              <span className="text-[11px] text-ink-400">Next: {meta.next}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProgressLine({ current }: { current: number }) {
  const labels = ["Drive", "Disc", "Output", "Start"];
  const percent = (current / (labels.length - 1)) * 100;
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fillRef.current) return;
    if (prefersReducedMotion()) {
      gsap.set(fillRef.current, { width: `${percent}%` });
      return;
    }
    gsap.to(fillRef.current, {
      width: `${percent}%`,
      duration: 0.6,
      ease: "power3.out",
    });
  }, [percent]);

  return (
    <div className="relative pt-2">
      <div className="relative h-px w-full bg-ink-200">
        <div
          ref={fillRef}
          className="absolute left-0 top-0 h-px"
          style={{
            width: 0,
            backgroundImage: "linear-gradient(90deg, #0A84FF 0%, #5AC8FA 100%)",
          }}
        />
      </div>
      <ol className="mt-4 grid grid-cols-4">
        {labels.map((l, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={l} className="flex flex-col items-start">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                  done
                    ? "bg-brand-500 text-white"
                    : active
                      ? "bg-white text-brand-600 ring-2 ring-brand-500"
                      : "bg-white text-ink-400 ring-1 ring-ink-200",
                )}
                style={
                  active
                    ? { boxShadow: "0 0 0 4px rgba(10,132,255,0.15)" }
                    : undefined
                }
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-2 text-[11px] uppercase tracking-[0.14em]",
                  active ? "text-ink-900 font-semibold" : "text-ink-400",
                )}
              >
                {l}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Step1({
  drive,
  setDrive,
}: {
  drive: DriveInfo | null;
  setDrive: (d: DriveInfo) => void;
}) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setDrives(await ipc.listDrives());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const unsub = events.onDrivesChanged((d) => {
      setDrives(d);
      if (!drive && d.length === 1) {
        setDrive(d[0]);
      }
    });
    return () => {
      unsub.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[12px] uppercase tracking-[0.14em] text-ink-400">
          Detected drives
        </span>
        <button className="btn btn-ghost" onClick={refresh}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>
      {drives.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
            <Disc3 className="h-6 w-6 text-brand-500" />
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-ink-500">
            {loading
              ? "Looking for drives…"
              : "Plug in your DVD drive — we'll spot it the moment it appears."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {drives.map((d) => {
            const friendly = [d.vendor, d.model]
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && s.toLowerCase() !== "unknown")
              .join(" ");
            const title = friendly || `Drive ${d.letter}`;
            const selected = drive?.path === d.path;
            return (
              <li key={d.path}>
                <button
                  onClick={() => setDrive(d)}
                  className={cn(
                    "w-full rounded-2xl border bg-white/70 p-4 text-left transition-all",
                    selected
                      ? "border-brand-500 bg-brand-50/60 shadow-[0_0_0_4px_rgba(10,132,255,0.12)]"
                      : "border-ink-200 hover:border-ink-300 hover:bg-white",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-medium text-ink-900">
                      {title}
                    </div>
                    {d.has_media ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Disc inserted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                        Empty
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-500">
                    Drive {d.letter}
                    {d.firmware && d.firmware.toLowerCase() !== "unknown" && (
                      <span> · firmware {d.firmware}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Step2({
  drive,
  disc,
  setDisc,
}: {
  drive: DriveInfo | null;
  disc: DiscInfo | null;
  setDisc: (d: DiscInfo) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const probe = async () => {
    if (!drive) return;
    setLoading(true);
    setError(null);
    try {
      const info = await ipc.checkDisc(drive.path);
      if (info) setDisc(info);
      else setError("No readable disc found in this drive.");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button className="btn btn-primary" onClick={probe} disabled={!drive || loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Read this disc
      </button>
      {error && <p className="mt-4 text-[13px] text-ios-red">{error}</p>}
      {disc && (
        <dl className="mt-5 grid grid-cols-4 gap-x-5 gap-y-3">
          <Field label="Label" value={disc.label} />
          <Field label="Type" value={disc.disc_type} />
          <Field
            label="Sectors"
            value={disc.total_sectors.toLocaleString()}
            mono
          />
          <Field
            label="Capacity"
            value={`${((disc.total_sectors * disc.sector_size) / 1024 / 1024 / 1024).toFixed(2)} GB`}
            mono
          />
        </dl>
      )}
    </div>
  );
}

function Step3({
  outputDir,
  setOutputDir,
  disc,
}: {
  outputDir: string;
  setOutputDir: (s: string) => void;
  disc: DiscInfo | null;
}) {
  const [drives, setDrives] = useState<StorageDrive[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const list = await ipc.listStorageDrives();
      setDrives(list);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  };

  useEffect(() => { refresh(); }, []);

  // Estimated disc size in bytes — used to flag drives without enough room.
  const discBytes = disc ? disc.total_sectors * disc.sector_size : 0;
  // Need ~1.6× headroom: ISO + VOBs + MP4 all live alongside each other.
  const recommendedFree = discBytes * 1.6;

  const safeLabel =
    (disc?.label ?? "")
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/_+/g, "_")
      .trim() || "Untitled disc";

  const useDrive = (d: StorageDrive) => {
    // Path like "D:\\DVD Rescue\\<disc-label>"
    const root = d.path.endsWith("\\") || d.path.endsWith("/") ? d.path : d.path + "\\";
    setOutputDir(`${root}DVD Rescue\\${safeLabel}`);
  };

  const browse = async () => {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose output folder",
    });
    if (typeof picked === "string") setOutputDir(picked);
  };

  return (
    <div className="space-y-5">
      {/* Drive picker — the headline UX */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow">Save to</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-[11px] text-ink-400 hover:text-ink-700 transition-colors"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
        {drives.length === 0 ? (
          <p className="text-[13px] text-ink-500">
            {refreshing ? "Looking for drives…" : "No drives found."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {drives.map((d) => {
              const tooSmall = recommendedFree > 0 && d.free_bytes < recommendedFree;
              const selected =
                outputDir.toUpperCase().startsWith(d.path.toUpperCase().replace(/\\$/, ""));
              return (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => useDrive(d)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    selected
                      ? "border-brand-500 bg-brand-50/60"
                      : "border-ink-200 bg-white/70 hover:border-ink-300",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {d.kind === "removable" ? (
                      <Usb className="h-4 w-4 shrink-0 text-brand-500" />
                    ) : (
                      <HardDrive className="h-4 w-4 shrink-0 text-ink-500" />
                    )}
                    <span className="font-mono text-[13px] font-semibold text-ink-900">
                      {d.path.replace(/\\$/, "")}
                    </span>
                    {d.label && (
                      <span className="text-[12px] text-ink-500">· {d.label}</span>
                    )}
                    {d.kind === "removable" && (
                      <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-700">
                        USB
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className={cn("tabular-nums", tooSmall ? "text-ios-red" : "text-ink-500")}>
                      {humanBytes(d.free_bytes)} free
                      {d.total_bytes > 0 && (
                        <span className="text-ink-400"> / {humanBytes(d.total_bytes)}</span>
                      )}
                    </span>
                    {tooSmall && (
                      <span className="text-[10px] text-ios-red">
                        May not fit recovery ({humanBytes(Math.ceil(recommendedFree))} suggested)
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom path field — secondary */}
      <div>
        <span className="eyebrow mb-2 block">Or pick a folder</span>
        <div className="flex gap-2">
          <input
            className="input flex-1 font-mono text-[13px]"
            placeholder="C:\Users\You\Documents\DVD Rescue"
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
          />
          <button className="btn btn-ghost" onClick={browse}>
            <FolderOpen className="h-4 w-4" /> Browse
          </button>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-500">
        Saving to a USB drive or external HDD is recommended if your computer's
        drive is low on space — recovery files can total {humanBytes(Math.ceil(recommendedFree))} or more.
      </p>
    </div>
  );
}

function humanBytes(n: number): string {
  if (n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function StartStep({
  disc,
  mode,
  setMode,
  onStart,
}: {
  disc: DiscInfo | null;
  mode: "standard" | "patient";
  setMode: (m: "standard" | "patient") => void;
  onStart: () => void;
}) {
  const minutes = disc ? Math.ceil((disc.total_sectors * 0.0034) / 60) : null;
  // Type-aware copy: "X minutes of video" only makes sense for DVD-Video.
  const isVideo = disc?.disc_type === "DvdVideo";
  const isAudio = disc?.disc_type === "DvdAudio";
  const sizeGb = disc ? (disc.total_sectors * disc.sector_size) / (1024 * 1024 * 1024) : 0;

  return (
    <div>
      {disc && (
        <p className="mb-3 text-[13px] text-ink-700">
          {isVideo && minutes !== null ? (
            <>About <strong className="tabular-nums">{minutes} minutes</strong> of video on this disc. </>
          ) : isAudio ? (
            <>An <strong>audio DVD</strong> with about <strong className="tabular-nums">{sizeGb.toFixed(2)} GB</strong> of content. </>
          ) : (
            <><strong className="tabular-nums">{sizeGb.toFixed(2)} GB</strong> of files on this disc — photos, documents, or whatever you backed up. </>
          )}
          You can pause or stop any time — your progress is saved automatically.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModeCard
          selected={mode === "standard"}
          onSelect={() => setMode("standard")}
          icon={<Shield className="h-5 w-5" />}
          accent="#0A84FF"
          title="Standard"
          tag="Recommended"
          time="~30–60 min"
          desc="Four passes, each more careful than the last. Most discs come back 90%+ in the first two."
        />
        <ModeCard
          selected={mode === "patient"}
          onSelect={() => setMode("patient")}
          icon={<Heart className="h-5 w-5" />}
          accent="#AF52DE"
          title="Patient"
          tag="For tough discs"
          time="Hours, sometimes overnight"
          desc="Slower reads, more retries, smaller blocks. Best for badly scratched or warped discs."
        />
      </div>

      <details className="mt-3 text-[12px] text-ink-500">
        <summary className="cursor-pointer hover:text-ink-700">
          How we'll do it
        </summary>
        <p className="mt-2 leading-relaxed">
          We make several passes across the surface, asking the drive to try
          again on areas it couldn't read first time. Damaged regions get
          smaller and smaller block sizes until we've got everything we can.
        </p>
      </details>

      <div className="mt-4">
        <button className="btn btn-primary" onClick={onStart}>
          <Disc3 className="h-4 w-4" />
          Rescue this disc
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  onSelect,
  icon,
  title,
  tag,
  time,
  desc,
  accent,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  tag: string;
  time: string;
  desc: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative rounded-2xl border bg-white/70 p-5 text-left transition-all",
        selected
          ? "border-transparent"
          : "border-ink-200 hover:border-ink-300 hover:bg-white",
      )}
      style={
        selected
          ? {
              boxShadow: `0 0 0 2px ${accent}, 0 12px 32px ${accent}25`,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}AA 100%)`,
            boxShadow: `0 6px 16px ${accent}40`,
          }}
        >
          {icon}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {tag}
        </span>
      </div>
      <h3 className="mt-3 font-display text-[18px] font-semibold tracking-tightish text-ink-900">
        {title}
      </h3>
      <p className="mt-0.5 text-[11px] tabular-nums text-ink-400">{time}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">{desc}</p>
    </button>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 text-[15px] font-medium text-ink-900",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
