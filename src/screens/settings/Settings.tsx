import { useEffect, useState } from "react";
import { useLicense } from "@/lib/useLicense";
import { Loader2, Check, ExternalLink, LogOut, Sparkles, Lock, FolderOpen, FileText, Volume2, Play } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { audio, type AudioPrefs } from "@/lib/audio";

const CHECKOUT_URL = "https://heirvo.com/buy"; // placeholder — swap to Lemon Squeezy URL
const SUPPORT_URL = "https://heirvo.com/support";

export function Settings() {
  const { status, loaded, activate, deactivate } = useLicense();
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const submit = async () => {
    if (!key.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await activate(key);
      setKey("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) {
      setConfirmDeactivate(true);
      // Auto-cancel after 5s
      setTimeout(() => setConfirmDeactivate(false), 5000);
      return;
    }
    await deactivate();
    setConfirmDeactivate(false);
  };

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <header className="mb-5">
        <span className="micro-label">Settings</span>
        <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.025em] text-ink-900">
          License & account
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Your Heirvo license. One-time purchase, no subscription.
        </p>
      </header>

      {status.plan === "pro" ? (
        <div
          className="mb-5 rounded-2xl border p-5"
          style={{
            background: "linear-gradient(135deg, rgba(52,199,89,0.10) 0%, rgba(52,199,89,0.04) 100%)",
            borderColor: "rgba(52,199,89,0.30)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90">
              <Check className="h-4 w-4 text-ios-green" />
            </div>
            <div className="flex-1">
              <div className="text-[16px] font-semibold text-ink-900">Heirvo Pro</div>
              <div className="text-[12px] text-ink-600">
                {status.holder ? `Activated for ${status.holder}` : "Active on this device"}
              </div>
            </div>
            <span className="rounded-full bg-ios-green/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ios-green">
              Active
            </span>
          </div>

          <div className="mt-5 border-t border-ios-green/20 pt-4">
            <button
              onClick={handleDeactivate}
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-ink-600 hover:border-ios-red/40 hover:text-ios-red transition-colors"
            >
              <LogOut className="h-3 w-3" />
              {confirmDeactivate ? "Confirm deactivate" : "Deactivate license"}
            </button>
            <p className="mt-2 text-[11px] text-ink-500">
              Removes the license from this device only. You can reactivate
              later with the same key.
            </p>
          </div>
        </div>
      ) : (
        <FreeTierPanel
          submit={submit}
          submitting={submitting}
          err={err}
          keyVal={key}
          setKey={setKey}
        />
      )}

      <div className="mt-6 rounded-2xl border border-ink-200/70 bg-white/60 p-5">
        <span className="micro-label">Privacy</span>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
          Heirvo runs entirely on your computer. We never upload your videos,
          photos, or recovered files anywhere. License validation only sends
          your key — never your media — and only when you activate or once a
          week to check for refunds.
        </p>
      </div>

      <DiagnosticLogsPanel />

      <SoundPanel />

      <div className="mt-4 flex flex-wrap gap-3 text-[12px] text-ink-500">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-brand-600"
          onClick={(e) => { e.preventDefault(); window.open(SUPPORT_URL, "_blank"); }}
        >
          <ExternalLink className="h-3 w-3" />
          Support
        </a>
        <span className="text-ink-300">·</span>
        <span>Heirvo v0.1.0</span>
      </div>
    </div>
  );
}

function FreeTierPanel({
  submit,
  submitting,
  err,
  keyVal,
  setKey,
}: {
  submit: () => void;
  submitting: boolean;
  err: string | null;
  keyVal: string;
  setKey: (v: string) => void;
}) {
  const buy = () => window.open(CHECKOUT_URL, "_blank");
  return (
    <>
      <div className="mb-5 rounded-2xl border border-ink-200/70 bg-white/70 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100">
            <Lock className="h-4 w-4 text-ink-500" />
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-semibold text-ink-900">Free</div>
            <div className="text-[12px] text-ink-600">
              Recovery is free — saving requires Pro
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-[13px] text-ink-700">
          <Feature locked text="Save as MP4 (lossless, instant)" />
          <Feature locked text="Save as ISO disc image" />
          <Feature locked text="Extract individual chapters" />
          <Feature locked text="Recover all files from data CDs" />
          <Feature locked text="AI restoration (upscale, denoise)" />
          <Feature locked text="Priority email support" />
        </ul>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-[32px] font-semibold tabular-nums text-ink-900">$39</span>
          <span className="text-[13px] text-ink-500">one-time, all updates included</span>
        </div>

        <button onClick={buy} className="btn btn-primary mt-4">
          <Sparkles className="h-4 w-4" />
          Upgrade to Pro
        </button>
      </div>

      <div className="rounded-2xl border border-ink-200/70 bg-white/60 p-5">
        <span className="micro-label">Already purchased?</span>
        <p className="mt-1 text-[12px] text-ink-500">
          Paste your license key below. It arrives by email after purchase.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1 font-mono text-[13px]"
            placeholder="HEIRVO-XXXX-XXXX-XXXX"
            value={keyVal}
            onChange={(e) => setKey(e.target.value)}
            disabled={submitting}
          />
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!keyVal.trim() || submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate"}
          </button>
        </div>
        {err && <p className="mt-2 text-[12px] text-ios-red">{err}</p>}
      </div>
    </>
  );
}

/**
 * Surfaces the rolling log file the engine writes to. Useful when the user
 * sees odd behavior ("drive went idle", "stuck at 3%") and we need to look
 * at SCSI errors, timeouts, or skip-ahead activity.
 */
function DiagnosticLogsPanel() {
  const [path, setPath] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    ipc.getLogPath()
      .then(setPath)
      .catch((e) => setErr(String(e)));
  }, []);

  const open = async () => {
    setOpening(true);
    setErr(null);
    try {
      await ipc.openLogFolder();
    } catch (e) {
      setErr(String(e));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100">
          <FileText className="h-4 w-4 text-ink-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="micro-label">Diagnostic logs</span>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
            Heirvo writes a rolling log of every drive command, retry, and
            skip-ahead so we can debug a problem without ever seeing your
            video. Useful if recovery gets stuck or a drive misbehaves.
          </p>
          {path && (
            <p className="mt-2 break-all font-mono text-[11px] text-ink-500">
              {path}
            </p>
          )}
          <button
            onClick={open}
            disabled={opening}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 transition-colors"
          >
            {opening ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FolderOpen className="h-3 w-3" />
            )}
            Open log folder
          </button>
          {err && <p className="mt-2 text-[11px] text-ios-red">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Subtle Apple-style audio cues during long unattended recoveries. Off by
 * default; user opts in. Synthesised via Web Audio API — see src/lib/audio.ts.
 */
function SoundPanel() {
  const [prefs, setPrefsState] = useState<AudioPrefs>(() => audio.getPrefs());
  // Debounce the persisted volume so dragging the slider doesn't write to
  // localStorage on every pointer move.
  const [pendingVolume, setPendingVolume] = useState<number | null>(null);

  useEffect(() => {
    if (pendingVolume === null) return;
    const t = window.setTimeout(() => {
      audio.setPrefs({ volume: pendingVolume });
      setPrefsState(audio.getPrefs());
      setPendingVolume(null);
    }, 200);
    return () => window.clearTimeout(t);
  }, [pendingVolume]);

  const toggle = () => {
    const next = !prefs.enabled;
    audio.setPrefs({ enabled: next });
    setPrefsState(audio.getPrefs());
    if (next) {
      // Tiny preview when turning on — confirms the user gesture initialised
      // the AudioContext and sets expectations for what "subtle" means.
      audio.play("milestone");
    }
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    // Reflect immediately in UI; persist after debounce.
    setPrefsState((p) => ({ ...p, volume: v }));
    setPendingVolume(v);
  };

  const test = () => audio.play("recovery_done");

  const displayVolume = Math.round((pendingVolume ?? prefs.volume) * 100);

  return (
    <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100">
          <Volume2 className="h-4 w-4 text-ink-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="micro-label">Sound</span>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
            Subtle chimes during recovery so you can step away and still hear
            when something matters. Off by default.
          </p>

          <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={toggle}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
            />
            <span className="flex-1">
              <span className="block text-[13px] font-medium text-ink-800">
                Play subtle chimes during recovery
              </span>
              <ul className="mt-2 space-y-1 text-[12px] text-ink-500">
                <li>• Milestone progress (every 10%)</li>
                <li>• Ring completion</li>
                <li>• Recovery finished</li>
                <li>• Drive warning</li>
              </ul>
            </span>
          </label>

          <div
            className={`mt-4 flex items-center gap-3 transition-opacity ${
              prefs.enabled ? "opacity-100" : "opacity-40 pointer-events-none"
            }`}
          >
            <span className="text-[11px] uppercase tracking-wider font-medium text-ink-500 w-14">
              Volume
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={displayVolume}
              onChange={onVolume}
              disabled={!prefs.enabled}
              className="flex-1 accent-brand-500 cursor-pointer"
              aria-label="Audio cue volume"
            />
            <span className="w-10 text-right tabular-nums text-[12px] text-ink-600">
              {displayVolume}%
            </span>
            <button
              onClick={test}
              disabled={!prefs.enabled}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 transition-colors"
            >
              <Play className="h-3 w-3" />
              Test sound
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text, locked }: { text: string; locked?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {locked
        ? <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
        : <Check className="mt-0.5 h-4 w-4 shrink-0 text-ios-green" />}
      <span className={locked ? "text-ink-500" : ""}>{text}</span>
    </li>
  );
}
