import { useEffect, useState } from "react";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { ipc, events } from "@/lib/ipc";
import type {
  FfmpegStatus,
  ProbeResult,
  QualityPreset,
  TranscodeProgress,
  InstallProgress,
} from "@/lib/types";
import {
  Film,
  Loader2,
  CheckCircle2,
  Download,
  AlertTriangle,
  Play,
  FolderOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/**
 * "Save a video" panel — second-pass redesign.
 *
 * Replaces the engineer-style FFmpeg config GUI that exposed codec dropdowns,
 * CRF acronyms, deinterlace/denoise library names, and a "Probe" button.
 * The new panel speaks to a 50-75 year-old non-technical user:
 *
 *   - One primary action per state (pick file → choose feel → save → done)
 *   - Native Windows Open/Save dialogs — no typed paths
 *   - Auto-probe runs silently on file pick
 *   - Codec is silently H.264 (the only option that plays everywhere)
 *   - Deinterlace is auto-detected from probe results, no checkbox
 *   - Denoise lives only behind "Advanced settings"
 *   - Quality collapses from 4 CRF tiers to 3 plain-English presets
 *   - Progress shows "about X minutes left" — never frame counts or fps
 */
export function TranscodePanel() {
  const [status, setStatus] = useState<FfmpegStatus | null>(null);
  const [input, setInput] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [quality, setQuality] = useState<QualityPreset>("high_quality"); // "Standard"
  const [denoise, setDenoise] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TranscodeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // FFmpeg install (only used in the very rare case bundling failed)
  const [install, setInstall] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);

  const refreshStatus = () =>
    ipc.ffmpegStatus().then(setStatus).catch(() => {});

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    const sub = events.onFfmpegInstallProgress((p) => {
      setInstall(p);
      if (p.stage === "installed") {
        setInstalling(false);
        refreshStatus();
      } else if (p.stage === "failed") {
        setInstalling(false);
      }
    });
    return () => {
      sub.then((fn) => fn());
    };
  }, []);

  const downloadFfmpeg = async () => {
    setInstalling(true);
    setInstall({
      stage: "starting",
      bytes_done: 0,
      bytes_total: 0,
      message: "Starting…",
    });
    try {
      await ipc.installFfmpeg();
    } catch (e) {
      setInstall({
        stage: "failed",
        bytes_done: 0,
        bytes_total: 0,
        message: String(e),
      });
      setInstalling(false);
    }
  };

  useEffect(() => {
    const unsubs = [
      events.onTranscodeProgress((p) => {
        if (jobId && p.job_id === jobId) setProgress(p);
      }),
      events.onTranscodeComplete((id) => {
        if (id === jobId) setDone(true);
      }),
      events.onTranscodeError((e) => {
        if (e.job_id === jobId) setError(e.error);
      }),
    ];
    return () => {
      unsubs.forEach((u) => u.then((fn) => fn()));
    };
  }, [jobId]);

  // Pick a source file with the native Open dialog, then auto-probe it.
  const pickInputFile = async () => {
    const picked = await openDialog({
      multiple: false,
      filters: [
        {
          name: "Rescued video",
          extensions: ["vob", "iso", "mp4", "mkv", "avi", "mov", "m2ts", "ts"],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!picked || Array.isArray(picked)) return;
    setInput(picked);
    setProbe(null);
    setProbing(true);
    setError(null);
    try {
      const p = await ipc.ffprobeFile(picked);
      setProbe(p);
      // Suggest an output filename next to the input, with " - Rescued.mp4".
      const lastDot = picked.lastIndexOf(".");
      const stem = lastDot > 0 ? picked.slice(0, lastDot) : picked;
      setOutput(`${stem} - Rescued.mp4`);
    } catch (e) {
      setError(String(e));
    } finally {
      setProbing(false);
    }
  };

  // Save dialog — pick where the MP4 goes.
  const chooseOutput = async (): Promise<string | null> => {
    const baseName =
      output.split(/[\\/]/).pop()?.replace(/\.mp4$/i, "") || "Rescued video";
    const picked = await saveDialog({
      defaultPath: output || `${baseName}.mp4`,
      filters: [{ name: "MP4 video", extensions: ["mp4"] }],
    });
    return picked ?? null;
  };

  const start = async () => {
    if (!input || !probe) return;
    let dest = output;
    // Always confirm with Save dialog — user expects "we'll ask you where".
    const chosen = await chooseOutput();
    if (!chosen) return; // user cancelled
    dest = chosen;
    setOutput(dest);

    setError(null);
    setDone(false);
    setProgress(null);
    try {
      const { job_id } = await ipc.transcode({
        input,
        output: dest,
        codec: "h264", // hard-coded — only universally-compatible option
        quality,
        deinterlace: probe.interlaced, // automatic from probe
        denoise,
        resolution: null,
      });
      setJobId(job_id);
    } catch (e) {
      setError(String(e));
    }
  };

  const reset = () => {
    setInput("");
    setOutput("");
    setProbe(null);
    setJobId(null);
    setProgress(null);
    setDone(false);
    setError(null);
  };

  const minutesLeft = (() => {
    if (!probe || !progress || probe.duration_secs <= 0 || progress.speed <= 0)
      return null;
    const done_secs = progress.out_time_us / 1_000_000;
    const remaining_secs = (probe.duration_secs - done_secs) / progress.speed;
    if (!Number.isFinite(remaining_secs) || remaining_secs < 0) return null;
    if (remaining_secs < 60) return "less than a minute";
    return `about ${Math.round(remaining_secs / 60)} minute${
      Math.round(remaining_secs / 60) === 1 ? "" : "s"
    }`;
  })();

  const pct =
    probe && progress && probe.duration_secs > 0
      ? Math.min(
          100,
          (progress.out_time_us / 1_000_000 / probe.duration_secs) * 100,
        )
      : null;

  // STATE: FFmpeg missing (rare — bundled now)
  if (status && !status.available) {
    return (
      <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[20px] font-semibold text-ink-900">
              One quick setup step
            </h2>
            <p className="mt-1 text-[15px] leading-[1.55] text-ink-600">
              Heirvo needs a small free helper to save your video (about 80 MB).
              It installs into your own user folder — you don't need a password
              or administrator access.
            </p>
            <button
              type="button"
              onClick={downloadFfmpeg}
              disabled={installing}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 text-[15px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500 disabled:opacity-50"
            >
              {installing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {installing ? "Installing helper…" : "Install helper"}
            </button>
            {install && installing && (
              <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
                {install.message}
                {install.bytes_total > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
                    <div
                      className="h-full bg-brand-600 transition-all"
                      style={{
                        width: `${(install.bytes_done / install.bytes_total) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <p className="mt-3 text-[12px] text-ink-500">
              We download the LGPL build from{" "}
              <button
                type="button"
                className="underline hover:text-brand-600"
                onClick={() => {
                  void openUrl("https://www.gyan.dev/ffmpeg/builds/");
                }}
              >
                gyan.dev
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // STATE: Saving (job in flight)
  if (jobId && !done && !error) {
    return (
      <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink-900">
            Saving your video…
          </h2>
        </div>
        <p className="mt-2 text-[15px] leading-[1.55] text-ink-700">
          <span className="font-medium">
            {output.split(/[\\/]/).pop() || "Rescued video.mp4"}
          </span>
        </p>

        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[13px] text-ink-500">
            <span>
              {minutesLeft
                ? `${minutesLeft} left`
                : "Working out how long this will take…"}
            </span>
            {pct !== null && <span>{pct.toFixed(0)}%</span>}
          </div>
        </div>

        <p className="mt-6 text-[13px] leading-[1.55] text-ink-500">
          It's safe to leave this window open and do something else. We'll let
          you know when it's done.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={reset}
            className="text-[13px] text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // STATE: Done
  if (done && output) {
    const folder = output.replace(/[\\/][^\\/]+$/, "");
    const filename = output.split(/[\\/]/).pop() || "Rescued video.mp4";
    return (
      <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/40 p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink-900">
              Done. Your video is saved.
            </h2>
            <p className="mt-1 text-[15px] leading-[1.55] text-ink-700">
              <span className="font-medium">{filename}</span>
              {probe && (
                <>
                  {" "}
                  · {formatDuration(probe.duration_secs)}
                </>
              )}
            </p>
            <p className="mt-1 text-[13px] text-ink-500">
              Saved to: <span className="font-mono">{folder || "your computer"}</span>
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void openPath(output);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2 text-[14px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500"
              >
                <Play className="h-4 w-4" />
                Play it now
              </button>
              <button
                type="button"
                onClick={() => {
                  void revealItemInDir(output);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-2 text-[14px] font-medium text-ink-700 transition hover:bg-ink-50"
              >
                <FolderOpen className="h-4 w-4" />
                Show me the file
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-2 text-[14px] font-medium text-ink-700 transition hover:bg-ink-50"
              >
                Save another video
              </button>
            </div>

            <p className="mt-5 text-[13px] leading-[1.55] text-ink-500">
              <span className="font-medium text-ink-700">Tip:</span> this file
              plays on any phone, TV, or computer. Email it, put it on a USB
              stick, or upload it to Google Photos to keep it safe forever.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // STATE: Error
  if (error) {
    return (
      <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[20px] font-semibold text-ink-900">
              Something went wrong while saving.
            </h2>
            <p className="mt-1 text-[15px] leading-[1.55] text-ink-600">
              The original file may be damaged or unreadable. Your other files
              are untouched.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={reset}
                className="rounded-2xl bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500"
              >
                Try a different file
              </button>
            </div>
            <details className="mt-4 text-[12px] text-ink-500">
              <summary className="cursor-pointer hover:text-ink-700">
                Technical details
              </summary>
              <pre className="mt-2 overflow-auto rounded-xl bg-ink-50 p-3 text-[11px]">
                {error}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }

  // STATE: Ready — empty (no file picked) or file picked (showing summary)
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-sm">
        {!input ? (
          <>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Film className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-[20px] font-semibold text-ink-900">
                  Pick a video to save
                </h2>
                <p className="mt-1 text-[15px] leading-[1.55] text-ink-600">
                  Choose a file you've already rescued — usually a{" "}
                  <code className="rounded bg-ink-100 px-1.5 py-0.5 text-[13px]">
                    .VOB
                  </code>{" "}
                  or{" "}
                  <code className="rounded bg-ink-100 px-1.5 py-0.5 text-[13px]">
                    .ISO
                  </code>{" "}
                  file. We'll save it as a regular MP4 you can play on any phone,
                  TV, or computer.
                </p>
                <button
                  type="button"
                  onClick={pickInputFile}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 text-[15px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500"
                >
                  Choose a file to save…
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Film className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-display text-[17px] font-semibold text-ink-900">
                    {input.split(/[\\/]/).pop()}
                  </h3>
                  <button
                    type="button"
                    onClick={pickInputFile}
                    className="text-[13px] text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline"
                  >
                    Pick a different file
                  </button>
                </div>
                {probing && (
                  <p className="mt-1 inline-flex items-center gap-2 text-[14px] text-ink-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking
                    your video…
                  </p>
                )}
                {probe && (
                  <p className="mt-1 text-[14px] text-ink-600">
                    {describeProbe(probe)}
                  </p>
                )}
              </div>
            </div>

            {probe && (
              <>
                <div className="mt-7">
                  <p className="text-[14px] font-medium text-ink-900">
                    How will you watch it?
                  </p>
                  <div className="mt-3 space-y-2">
                    <QualityRadio
                      checked={quality === "archive"}
                      onChange={() => setQuality("archive")}
                      label="Best quality"
                      sub="Largest file. Best for archiving."
                    />
                    <QualityRadio
                      checked={quality === "high_quality"}
                      onChange={() => setQuality("high_quality")}
                      label="Standard"
                      sub="Recommended. Looks great on TVs and computers."
                      recommended
                    />
                    <QualityRadio
                      checked={quality === "mobile"}
                      onChange={() => setQuality("mobile")}
                      label="Smaller file"
                      sub="Easier to email or fit on a phone."
                    />
                  </div>
                </div>

                <div className="mt-7 flex flex-col items-start gap-2">
                  <button
                    type="button"
                    onClick={start}
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-[15px] font-semibold text-white shadow-glow-blue transition hover:bg-brand-500"
                  >
                    Save my video
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-[12px] text-ink-500">
                    We'll ask you where to save it.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Advanced settings — collapsed by default forever */}
      {input && probe && (
        <div className="rounded-2xl border border-ink-200/60 bg-white/50">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-[13px] text-ink-500 hover:text-ink-700 transition"
          >
            <span>Advanced settings</span>
            {advanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {advanced && (
            <div className="space-y-4 border-t border-ink-200/60 px-5 py-4">
              <label className="flex cursor-pointer items-start gap-3 text-[14px] text-ink-700">
                <input
                  type="checkbox"
                  checked={denoise}
                  onChange={(e) => setDenoise(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span>
                  Reduce grain
                  <span className="ml-1 text-[12px] text-ink-500">
                    — can soften faces; only use on very noisy video
                  </span>
                </span>
              </label>
              <div className="text-[12px] text-ink-500">
                <div>
                  Video format is always <span className="font-medium">H.264 MP4</span>{" "}
                  — the only format that plays on every device.
                </div>
                <div className="mt-1">
                  We{" "}
                  {probe.interlaced
                    ? "automatically fixed interlacing"
                    : "didn't need to fix interlacing"}{" "}
                  on this file.
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer hover:text-ink-700">
                    File details
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>Length</span>
                    <span>{formatDuration(probe.duration_secs)}</span>
                    <span>Picture size</span>
                    <span>
                      {probe.width}×{probe.height}
                    </span>
                    <span>Original video format</span>
                    <span>{probe.video_codec}</span>
                    <span>Audio</span>
                    <span>{probe.audio_codec}</span>
                    <span>Interlaced</span>
                    <span>{probe.interlaced ? "Yes" : "No"}</span>
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders a probe result as ONE plain-English sentence. */
function describeProbe(p: ProbeResult): string {
  const length = formatDuration(p.duration_secs);
  const size = describeResolution(p.width, p.height);
  const interlace = p.interlaced
    ? " We'll smooth out the flickering lines automatically."
    : "";
  return `${size}, ${length}.${interlace}`;
}

function formatDuration(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const total = Math.round(secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h} hour${h === 1 ? "" : "s"}${
      m > 0 ? ` ${m} minute${m === 1 ? "" : "s"}` : ""
    }`;
  }
  if (m > 0) {
    return `${m} minute${m === 1 ? "" : "s"}${
      s > 0 ? ` ${s} second${s === 1 ? "" : "s"}` : ""
    }`;
  }
  return `${s} second${s === 1 ? "" : "s"}`;
}

function describeResolution(w: number, _h: number): string {
  if (w >= 1920) return "HD video";
  if (w >= 1280) return "HD video";
  if (w >= 700) return "Standard DVD video";
  if (w > 0) return "Video";
  return "Video";
}

function QualityRadio({
  checked,
  onChange,
  label,
  sub,
  recommended,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  sub: string;
  recommended?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
        checked
          ? "border-brand-300 bg-brand-50/50"
          : "border-ink-200 bg-white hover:border-ink-300"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-brand-600"
      />
      <span className="flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium text-ink-900">{label}</span>
          {recommended && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
              Recommended
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-500">{sub}</span>
      </span>
    </label>
  );
}
