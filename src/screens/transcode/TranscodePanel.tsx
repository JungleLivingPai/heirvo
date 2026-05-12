import { useEffect, useState } from "react";
import { ipc, events } from "@/lib/ipc";
import type {
  FfmpegStatus,
  InstallProgress,
  OutputCodec,
  ProbeResult,
  QualityPreset,
  TranscodeProgress,
} from "@/lib/types";
import { Film, Loader2, AlertTriangle, CheckCircle2, Download } from "lucide-react";

export function TranscodePanel() {
  const [status, setStatus] = useState<FfmpegStatus | null>(null);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [codec, setCodec] = useState<OutputCodec>("h264");
  const [quality, setQuality] = useState<QualityPreset>("streaming");
  const [deinterlace, setDeinterlace] = useState(true);
  const [denoise, setDenoise] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TranscodeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const refreshStatus = () => ipc.ffmpegStatus().then(setStatus).catch(() => {});

  useEffect(() => {
    refreshStatus();
  }, []);

  const [install, setInstall] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);

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
    setInstall({ stage: "starting", bytes_done: 0, bytes_total: 0, message: "Starting…" });
    try {
      await ipc.installFfmpeg();
    } catch (e) {
      setInstall({ stage: "failed", bytes_done: 0, bytes_total: 0, message: String(e) });
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

  const probeInput = async () => {
    if (!input) return;
    setError(null);
    try {
      const p = await ipc.ffprobeFile(input);
      setProbe(p);
      if (p.interlaced) setDeinterlace(true);
      if (!output) {
        const dot = input.lastIndexOf(".");
        const stem = dot > 0 ? input.slice(0, dot) : input;
        setOutput(`${stem}_recovered.mp4`);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const start = async () => {
    setError(null);
    setDone(false);
    setProgress(null);
    try {
      const { job_id } = await ipc.transcode({
        input,
        output,
        codec,
        quality,
        deinterlace,
        denoise,
        resolution: null,
      });
      setJobId(job_id);
    } catch (e) {
      setError(String(e));
    }
  };

  const pct =
    probe && progress && probe.duration_secs > 0
      ? Math.min(100, (progress.out_time_us / 1_000_000 / probe.duration_secs) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
          <Film className="h-4 w-4" />
          <span>FFmpeg</span>
        </div>
        {status === null ? (
          <p className="text-sm text-zinc-500">Checking…</p>
        ) : status.available ? (
          <p className="text-sm text-emerald-400">
            <CheckCircle2 className="mr-1 inline h-4 w-4" />
            {status.version ?? "ffmpeg available"}
          </p>
        ) : (
          <div>
            <p className="text-sm text-amber-400">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              FFmpeg not found.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Click below to download the latest LGPL build (~80 MB) from{" "}
              <a
                className="underline"
                href="https://www.gyan.dev/ffmpeg/builds/"
                target="_blank"
                rel="noreferrer"
              >
                gyan.dev
              </a>
              . It will be installed into your app data folder; no admin required.
            </p>
            <button
              className="btn btn-primary mt-3"
              onClick={downloadFfmpeg}
              disabled={installing}
            >
              {installing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download FFmpeg
            </button>
            {install && (
              <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs">
                <div className="mb-1 flex justify-between">
                  <span className="capitalize text-zinc-400">{install.stage}</span>
                  {install.bytes_total > 0 && (
                    <span className="text-zinc-500">
                      {((install.bytes_done / install.bytes_total) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {install.bytes_total > 0 && (
                  <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-brand-600 transition-all"
                      style={{
                        width: `${(install.bytes_done / install.bytes_total) * 100}%`,
                      }}
                    />
                  </div>
                )}
                <div className="text-zinc-300">{install.message}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <Field label="Input file (VOB or ISO mount path)">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="C:\\path\\to\\VTS_01_1.VOB"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn btn-ghost" onClick={probeInput} disabled={!input}>
              Probe
            </button>
          </div>
        </Field>

        {probe && (
          <dl className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
            <div>
              <dt>Duration</dt>
              <dd className="text-zinc-200">{probe.duration_secs.toFixed(1)}s</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd className="text-zinc-200">{probe.width}×{probe.height}</dd>
            </div>
            <div>
              <dt>Codec</dt>
              <dd className="text-zinc-200">{probe.video_codec}</dd>
            </div>
            <div>
              <dt>Audio</dt>
              <dd className="text-zinc-200">{probe.audio_codec}</dd>
            </div>
            <div>
              <dt>Interlaced</dt>
              <dd className="text-zinc-200">{probe.interlaced ? "Yes" : "No"}</dd>
            </div>
          </dl>
        )}

        <Field label="Output file">
          <input
            className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="C:\\path\\to\\output.mp4"
            value={output}
            onChange={(e) => setOutput(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Codec">
            <select
              className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-sm"
              value={codec}
              onChange={(e) => setCodec(e.target.value as OutputCodec)}
            >
              <option value="h264">H.264 (broadest compatibility)</option>
              <option value="h265">H.265 / HEVC (smaller files)</option>
              <option value="av1">AV1 (best quality/size)</option>
            </select>
          </Field>
          <Field label="Quality">
            <select
              className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-sm"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityPreset)}
            >
              <option value="archive">Archive (CRF 14–22, large)</option>
              <option value="high_quality">High quality (CRF 18–28)</option>
              <option value="streaming">Streaming (CRF 23–34)</option>
              <option value="mobile">Mobile (CRF 26–38)</option>
            </select>
          </Field>
        </div>

        <div className="flex gap-6">
          <Toggle label="Deinterlace (bwdif)" checked={deinterlace} onChange={setDeinterlace} />
          <Toggle label="Denoise (hqdn3d)" checked={denoise} onChange={setDenoise} />
        </div>

        <button
          className="btn btn-primary"
          onClick={start}
          disabled={!input || !output || !status?.available || (jobId !== null && !done && !error)}
        >
          {jobId && !done && !error && <Loader2 className="h-4 w-4 animate-spin" />}
          Start transcode
        </button>

        {progress && (
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs">
            <div className="mb-1 flex justify-between">
              <span>
                Frame {progress.frame.toLocaleString()} · {progress.fps.toFixed(1)} fps ·{" "}
                {progress.speed.toFixed(2)}×
              </span>
              {pct !== null && <span>{pct.toFixed(1)}%</span>}
            </div>
            {pct !== null && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        )}

        {done && <p className="text-sm text-emerald-400">✓ Transcode complete</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-600"
      />
      {label}
    </label>
  );
}
