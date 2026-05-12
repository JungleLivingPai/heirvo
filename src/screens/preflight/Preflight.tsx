import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Download } from "lucide-react";
import { ipc, events } from "@/lib/ipc";
import type { PreflightStatus, PreflightCheck } from "@/lib/types";

/**
 * First-launch environment check. Verifies FFmpeg, ONNX runtime, optical
 * drives, and license status BEFORE the user encounters a "doesn't work"
 * wall. Only critical checks (FFmpeg) block "Continue"; AI/drives are
 * non-blocking — the user can still recover discs without them.
 */
export default function Preflight() {
  const nav = useNavigate();
  const [status, setStatus] = useState<PreflightStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState<string | null>(null);

  const refreshStatus = () => {
    ipc
      .getPreflightStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    refreshStatus();
    // Subscribe to FFmpeg install progress events.
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
    return () => { sub.then((unsub) => unsub()); };
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

  const onContinue = async (skipAi: boolean) => {
    void skipAi; // Currently we always store the same flag — skipAi is informational.
    try {
      await ipc.markPreflightSeen();
      nav("/", { replace: true });
    } catch (e) {
      setError(String(e));
    }
  };

  const onnxFailedOnly = (() => {
    if (!status) return false;
    const onnx = status.checks.find((c) => c.id === "onnx");
    return status.allCriticalOk && onnx?.ok === false;
  })();

  const ffmpegMissing =
    status?.checks.find((c) => c.id === "ffmpeg")?.ok === false;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="w-full max-w-xl rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-xl backdrop-blur"
        style={{ WebkitBackdropFilter: "blur(20px)" }}
      >
        <h1 className="font-display text-2xl font-semibold text-ink-900">
          Welcome to Heirvo
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Let's check that everything is ready before you recover your first disc.
        </p>

        <div className="mt-6 space-y-2">
          {!status && !error && (
            <Row
              ok={null}
              label="Checking environment…"
              detail="Running preflight checks"
            />
          )}
          {error && (
            <div className="rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">
              Couldn't run preflight: {error}
            </div>
          )}
          {status?.checks.map((c) => (
            <Row key={c.id} ok={c.ok} label={c.label} detail={c.detail} critical={c.critical} />
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          {ffmpegMissing && (
            <button
              onClick={installFfmpeg}
              disabled={installingFfmpeg}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-ink-100 disabled:opacity-50"
            >
              {installingFfmpeg ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {installingFfmpeg
                ? (ffmpegProgress ?? "Installing…")
                : "Install FFmpeg now (~80MB)"}
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {onnxFailedOnly && (
              <button
                onClick={() => onContinue(true)}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-100"
              >
                Continue without AI
              </button>
            )}
            <button
              onClick={() => onContinue(false)}
              disabled={!status || !status.allCriticalOk}
              className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-glow-blue transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  ok,
  label,
  detail,
  critical,
}: {
  ok: PreflightCheck["ok"];
  label: string;
  detail: string;
  critical?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-ink-200/60 bg-white/60 px-4 py-3">
      <div className="mt-0.5 shrink-0">
        {ok === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
        ) : ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : critical ? (
          <XCircle className="h-5 w-5 text-red-500" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink-900">{label}</div>
        <div className="mt-0.5 truncate text-xs text-ink-500">{detail}</div>
      </div>
    </div>
  );
}
