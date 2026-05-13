import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useLicense } from "@/lib/useLicense";
import { Loader2, Check, ExternalLink, LogOut, Sparkles, FolderOpen, FileText, Volume2, Play, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { audio, type AudioPrefs } from "@/lib/audio";

const CHECKOUT_URL = "https://heirvo.com/buy"; // placeholder — swap to Lemon Squeezy URL
const SUPPORT_URL = "https://heirvo.com/support";
const MAILIN_URL = "https://heirvo.com/recover";

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
      {/* Header — status-aware */}
      <header className="mb-5">
        <span className="micro-label">Settings</span>
        <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.025em] text-ink-900">
          Your Heirvo
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          {status.plan === "pro"
            ? "Everything set up and ready to recover your discs."
            : "You're using the free version. Upgrade when you're ready — your memories are worth it."}
        </p>
      </header>

      {/* Two paths — side by side */}
      <div className="grid grid-cols-2 gap-5">
        {status.plan === "pro" ? (
          <ProPanel
            holder={status.holder ?? null}
            confirmDeactivate={confirmDeactivate}
            onDeactivate={handleDeactivate}
          />
        ) : (
          <FreeTierPanel />
        )}
        {/* Mail-in disc service — co-equal path */}
        <MailInPanel />
      </div>

      {/* Already purchased — full width below the two cards */}
      {status.plan !== "pro" && (
        <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60 p-5">
          <span className="micro-label">Already purchased?</span>
          <p className="mt-1 text-[12px] text-ink-500">
            Enter the code from your purchase email to unlock all features.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="input flex-1 font-mono text-[13px]"
              placeholder="Paste your code here"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={submitting}
            />
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!key.trim() || submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate"}
            </button>
          </div>
          {err && <p className="mt-2 text-[12px] text-ios-red">{err}</p>}
        </div>
      )}

      {/* Sound */}
      <SoundPanel />

      {/* Need help? — promoted above footer */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-ink-200/70 bg-white/60 px-5 py-4">
        <p className="text-[13px] text-ink-700">
          Need help? Our support team is here.
        </p>
        <button
          onClick={() => { void openUrl(SUPPORT_URL); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Contact support
        </button>
      </div>

      {/* Privacy */}
      <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60 p-5">
        <span className="micro-label">Privacy</span>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
          Heirvo runs entirely on your computer. We never upload your videos,
          photos, or recovered files anywhere. License validation only sends
          your key — never your media — and only when you activate or once a
          week to check for refunds.
        </p>
      </div>

      {/* Advanced & troubleshooting — collapsed by default */}
      <DiagnosticLogsPanel />

      {/* Footer */}
      <div className="mt-4 text-[12px] text-ink-400">
        Heirvo v0.1.0
      </div>
    </div>
  );
}

// ─── Pro active state ─────────────────────────────────────────────────────────

function ProPanel({
  holder,
  confirmDeactivate,
  onDeactivate,
}: {
  holder: string | null;
  confirmDeactivate: boolean;
  onDeactivate: () => void;
}) {
  return (
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
          <div className="text-[16px] font-semibold text-ink-900">You're all set.</div>
          <div className="text-[12px] text-ink-600">
            {holder ? `Licensed to ${holder}` : "Active on this device — all recovery features unlocked."}
          </div>
        </div>
        <span className="rounded-full bg-ios-green/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ios-green">
          Pro
        </span>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-600">
        Thank you for trusting us with something this important.
      </p>

      <div className="mt-5 border-t border-ios-green/20 pt-4">
        <button
          onClick={onDeactivate}
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
  );
}

// ─── Free tier ────────────────────────────────────────────────────────────────

function FreeTierPanel() {
  const buy = () => { void openUrl(CHECKOUT_URL); };
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
      style={{
        background: "linear-gradient(160deg, #1a3fa8 0%, #0f276e 55%, #091850 100%)",
        borderColor: "rgba(110,150,255,0.35)",
        boxShadow: "0 4px 28px rgba(10,30,110,0.40)",
      }}
      onClick={buy}
    >
      {/* Ambient glow — top right */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ background: "radial-gradient(circle, #6ea8ff 0%, transparent 70%)" }}
      />

      {/* Card body */}
      <div className="relative flex flex-col flex-1 p-5">
        {/* Icon + badge row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.80)" }}
          >
            Pro
          </span>
        </div>

        {/* Title */}
        <h2 className="font-display text-[19px] font-bold leading-tight tracking-[-0.02em] text-white">
          Unlock everything.
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          One payment. All recovery features, forever.
        </p>

        {/* Feature list — green checkmarks */}
        <ul className="mt-4 space-y-2">
          {[
            { text: "Save videos as playable MP4 files" },
            { text: "Full disc backup image" },
            { text: "Auto-sharpen blurry footage" },
            { text: "+ 3 more features", dim: true },
          ].map(({ text, dim }) => (
            <li key={text} className="flex items-center gap-2.5">
              <div
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: dim ? "rgba(255,255,255,0.07)" : "rgba(74,222,128,0.20)" }}
              >
                <Check
                  className="h-2.5 w-2.5"
                  style={{ color: dim ? "rgba(255,255,255,0.25)" : "#4ade80" }}
                />
              </div>
              <span
                className="text-[12px]"
                style={{ color: dim ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.78)" }}
              >
                {text}
              </span>
            </li>
          ))}
        </ul>

        {/* Price + CTA — pinned to bottom */}
        <div className="mt-auto pt-5">
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="font-display text-[32px] font-bold tabular-nums leading-none text-white">
              $39
            </span>
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.42)" }}>
              one-time
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); buy(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #4f7fff 0%, #2d5fe8 100%)",
              boxShadow: "0 2px 14px rgba(45,95,232,0.60)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mail-in disc service ─────────────────────────────────────────────────────

function MailInPanel() {
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
      style={{
        background: "linear-gradient(160deg, #7a3800 0%, #4d2200 55%, #2e1500 100%)",
        borderColor: "rgba(255,159,10,0.38)",
        boxShadow: "0 4px 28px rgba(100,50,0,0.45)",
      }}
      onClick={() => { void openUrl(MAILIN_URL); }}
    >
      {/* Ambient glow — top right */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
        style={{ background: "radial-gradient(circle, #ff9f0a 0%, transparent 70%)" }}
      />

      {/* Card body */}
      <div className="relative flex flex-col flex-1 p-5">
        {/* Icon + badge row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
            style={{
              background: "rgba(255,159,10,0.18)",
              border: "1px solid rgba(255,159,10,0.30)",
            }}
          >
            <Mail className="h-5 w-5" style={{ color: "#FFB830" }} />
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: "rgba(255,159,10,0.18)", color: "rgba(255,185,80,0.90)" }}
          >
            Service
          </span>
        </div>

        {/* Title */}
        <h2 className="font-display text-[19px] font-bold leading-tight tracking-[-0.02em] text-white">
          Disc too damaged?
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          Mail it to us — professional tools, real people.
        </p>

        {/* Feature list — amber checkmarks */}
        <ul className="mt-4 space-y-2">
          {[
            "No disc drive needed on your end",
            "Specialist tools for badly scratched discs",
            "Safe return — your disc comes back too",
          ].map((text) => (
            <li key={text} className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(255,159,10,0.22)" }}
              >
                <Check className="h-2.5 w-2.5" style={{ color: "#FF9F0A" }} />
              </div>
              <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                {text}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA — pinned to bottom, full-width */}
        <div className="mt-auto pt-5">
          <button
            onClick={(e) => { e.stopPropagation(); void openUrl(MAILIN_URL); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #ff9f0a 0%, #d45f00 100%)",
              boxShadow: "0 2px 14px rgba(200,90,0,0.55)",
            }}
          >
            <Mail className="h-4 w-4" />
            Mail us your disc
            <ExternalLink className="h-3.5 w-3.5 opacity-75" />
          </button>
          <p className="mt-2 text-center text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
            Separate paid service — pricing on the page
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sound panel ──────────────────────────────────────────────────────────────

function SoundPanel() {
  const [prefs, setPrefsState] = useState<AudioPrefs>(() => audio.getPrefs());
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
    if (next) audio.play("milestone");
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
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

          <label className="mt-3 flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={toggle}
              className="h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
            />
            <span className="text-[13px] font-medium text-ink-800">
              Play a sound when recovery finishes
            </span>
          </label>
          <p className="mt-1.5 pl-7 text-[12px] text-ink-500">
            A gentle chime lets you know it's done — handy if you step away
            while Heirvo is working.
          </p>

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
              Play a sample
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Diagnostic logs — collapsed under Advanced ───────────────────────────────

function DiagnosticLogsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [showPath, setShowPath] = useState(false);
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
    <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60">
      {/* Collapsed trigger */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left text-[13px] font-medium text-ink-600 hover:text-ink-900 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
        )}
        Advanced & troubleshooting
      </button>

      {expanded && (
        <div className="border-t border-ink-200/70 px-5 pb-5 pt-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100">
              <FileText className="h-4 w-4 text-ink-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="micro-label">If something goes wrong</span>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
                Heirvo quietly keeps a record of what it does behind the
                scenes. If you contact support, they may ask you to share this
                file — it helps them understand exactly what happened with
                your disc.
              </p>

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
                Send activity log to support
              </button>

              {/* Raw path — hidden by default, revealed on request */}
              <button
                onClick={() => setShowPath((v) => !v)}
                className="mt-2 ml-0.5 text-[11px] text-ink-400 hover:text-ink-600 transition-colors underline underline-offset-2"
              >
                {showPath ? "Hide file location" : "Where is this file on my computer?"}
              </button>
              {showPath && path && (
                <p className="mt-1.5 break-all font-mono text-[11px] text-ink-500">
                  {path}
                </p>
              )}
              {err && <p className="mt-2 text-[11px] text-ios-red">{err}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

