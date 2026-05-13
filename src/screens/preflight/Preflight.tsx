import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ipc, events } from "@/lib/ipc";
import type { PreflightStatus, PreflightCheck } from "@/lib/types";

/**
 * First-launch welcome screen.
 *
 * Replaces the older "diagnostic checklist" pattern that greeted brand-new
 * users with three amber warning triangles before they'd done anything.
 * The new shape:
 *
 *   1. Big warm welcome + one obvious primary action ("Let's get started").
 *   2. Conditional secondary CTA based on whether a drive is detected
 *      (no drive → mail-in service; drive present → start a rescue).
 *   3. Diagnostics survive in a collapsed "System details" footer for
 *      the curious / for support calls — but never lead the experience.
 *
 * All checks are non-critical (FFmpeg ships bundled, ONNX is optional,
 * drives can be plugged in later, license is free) so the primary CTA is
 * always enabled. If FFmpeg bundling fails (rare), we surface the install
 * affordance inline in the collapsed panel rather than blocking the user.
 */
export default function Preflight() {
  const nav = useNavigate();
  const [status, setStatus] = useState<PreflightStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const refreshStatus = () => {
    ipc
      .getPreflightStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    refreshStatus();
    const sub = events.onFfmpegInstallProgress((p) => {
      setFfmpegProgress(`${p.stage}: ${p.message}`);
      if (p.stage === "installed") {
        setInstallingFfmpeg(false);
        setFfmpegProgress(null);
        refreshStatus();
      } else if (p.stage === "failed") {
        setInstallingFfmpeg(false);
        setError(p.message);
      }
    });
    return () => {
      sub.then((unsub) => unsub());
    };
  }, []);

  const installFfmpeg = async () => {
    setInstallingFfmpeg(true);
    setError(null);
    try {
      await ipc.installFfmpeg();
    } catch (e) {
      setInstallingFfmpeg(false);
      setError(String(e));
    }
  };

  const onContinue = async (destination: string) => {
    try {
      await ipc.markPreflightSeen();
      nav(destination, { replace: true });
    } catch (e) {
      setError(String(e));
    }
  };

  const driveReady =
    status?.checks.find((c) => c.id === "drives")?.ok === true;
  const ffmpegMissing =
    status?.checks.find((c) => c.id === "ffmpeg")?.detail.toLowerCase().includes("fetch") === true;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="w-full max-w-xl rounded-3xl border border-ink-200/70 bg-white/80 p-10 shadow-xl backdrop-blur"
        style={{ WebkitBackdropFilter: "blur(20px)" }}
      >
        {/* Welcome */}
        <h1 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink-900">
          Welcome to Heirvo.
        </h1>
        <p className="mt-2 text-[17px] font-medium text-ink-700">
          Your memories are in good hands.
        </p>
        <p className="mt-4 max-w-lg text-[15px] leading-[1.55] text-ink-600">
          We'll walk you through your first disc one step at a time — no
          technical know-how needed. Most people save their first video in
          under ten minutes.
        </p>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Primary CTA */}
        <div className="mt-7 flex flex-col items-start gap-3">
          <button
            onClick={() => onContinue("/")}
            disabled={!status}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-7 py-3 text-[15px] font-semibold text-white shadow-glow-blue transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none"
          >
            Let's get started
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Conditional secondary CTA */}
          {status && !driveReady && (
            <button
              onClick={() => {
                void openUrl("https://heirvo.com/recover").catch((e) =>
                  setError(`Couldn't open browser: ${e}`),
                );
              }}
              className="text-[13px] text-ink-500 hover:text-brand-600 transition"
            >
              No disc drive? Use our mail-in service →
            </button>
          )}
          {status && driveReady && (
            <button
              onClick={() => onContinue("/wizard")}
              className="text-[13px] text-ink-500 hover:text-brand-600 transition"
            >
              Already have a disc inserted? Start a rescue →
            </button>
          )}
        </div>

        {/* Collapsed system details */}
        <div className="mt-10 border-t border-ink-200/70 pt-4">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex w-full items-center justify-between text-[12px] text-ink-500 hover:text-ink-700 transition"
          >
            <span className="flex items-center gap-2">
              {!status ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {status ? "Heirvo is ready · System details" : "Checking…"}
            </span>
            {detailsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {detailsOpen && (
            <div className="mt-3 space-y-2">
              {status?.checks.map((c) => (
                <Row key={c.id} check={c} />
              ))}

              {ffmpegMissing && (
                <button
                  onClick={installFfmpeg}
                  disabled={installingFfmpeg}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-ink-100 disabled:opacity-50"
                >
                  {installingFfmpeg ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  {installingFfmpeg
                    ? (ffmpegProgress ?? "Installing helper file…")
                    : "Install video helper now (~80 MB)"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ check }: { check: PreflightCheck }) {
  // Visual language rule: green for ready, blue info for "needs the user
  // to do something later". NEVER amber, NEVER warning triangles.
  const isInfo = check.id === "drives" && check.ok === false;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-200/60 bg-white/60 px-3.5 py-2.5">
      <div className="mt-0.5 shrink-0">
        {isInfo ? (
          <Info className="h-4 w-4 text-brand-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink-900">
          {check.label}
        </div>
        <div className="mt-0.5 text-[12px] leading-snug text-ink-500">
          {check.detail}
        </div>
      </div>
    </div>
  );
}
