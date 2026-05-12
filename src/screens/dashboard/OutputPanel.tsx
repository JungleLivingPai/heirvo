import { useState, useEffect } from "react";
import { ipc } from "@/lib/ipc";
import type { HealthReport, IsoResult, ExtractedFile, StorageDrive, Session, AudioToc, ExtractedAudioFile } from "@/lib/types";
import { FileVideo, Files, Loader2, FileArchive, LifeBuoy, Save, Upload, Usb, HardDrive, Pencil, Lock, Sparkles, Music, FolderOpen } from "lucide-react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { bytesToHuman } from "@/lib/human";
import { useLicense } from "@/lib/useLicense";
import { cn } from "@/lib/cn";

type Mp4Result = { output_path: string; bytes_written: number; source_files: string[] };
type DiagnosticBundle = { zip_path: string; bytes: number; session_id: string };
type RmapExport = { path: string; bytes_written: number; run_count: number };
type RmapImport = {
  good_sectors: number;
  failed_sectors: number;
  skipped_sectors: number;
  unknown_sectors: number;
};

export function OutputPanel({ sessionId }: { sessionId: string }) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [mp4, setMp4] = useState<Mp4Result | null>(null);
  const [iso, setIso] = useState<IsoResult | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFile[] | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticBundle | null>(null);
  const [rmapExport, setRmapExport] = useState<RmapExport | null>(null);
  const [rmapImport, setRmapImport] = useState<RmapImport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { status: license } = useLicense();
  const canSave = license.can_save;

  // Output destination state — fetched and editable mid-recovery
  const [session, setSession] = useState<Session | null>(null);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [storageDrives, setStorageDrives] = useState<StorageDrive[]>([]);

  // Pull session details so we can show + edit output_dir
  useEffect(() => {
    ipc.listSessions()
      .then((all) => setSession(all.find((s) => s.id === sessionId) ?? null))
      .catch(() => {});
  }, [sessionId]);

  // Audio CD probe — runs on mount. If READ TOC succeeds with tracks, the
  // panel switches to audio-CD-only mode (WAV extraction).
  const [audioToc, setAudioToc] = useState<AudioToc | null>(null);
  const [audioTracks, setAudioTracks] = useState<ExtractedAudioFile[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    ipc.readAudioToc(sessionId)
      .then((toc) => {
        if (!cancelled && toc.tracks.length > 0) setAudioToc(toc);
      })
      .catch(() => { /* not an audio CD — leave default UI */ });
    return () => { cancelled = true; };
  }, [sessionId]);
  const isAudioCd = audioToc !== null;

  // Disc-type-aware Save UX. NULL/Unknown -> show everything (graceful fallback).
  const t = session?.disc_type ?? null;
  const isUnknownDisc = !t || t === "Unknown";
  // For audio CDs we hide all data buttons — only WAV extraction makes sense.
  const showVideoSaves = !isAudioCd && (isUnknownDisc || t === "DvdVideo");
  const showFileSaves = !isAudioCd && (isUnknownDisc || t === "Cd" || t === "DvdRom" || t === "DvdAudio");
  const showIso = !isAudioCd; // ISO doesn't apply to CD-DA.

  const refreshDrives = async () => {
    try { setStorageDrives(await ipc.listStorageDrives()); }
    catch { /* ignore */ }
  };

  const useDrive = async (d: StorageDrive) => {
    if (!session) return;
    // Preserve the disc-name leaf folder; rebase onto the new drive root.
    const safeLabel = (session.disc_label || "Untitled disc")
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/_+/g, "_")
      .trim() || "Untitled disc";
    const root = d.path.endsWith("\\") || d.path.endsWith("/") ? d.path : d.path + "\\";
    const newDir = `${root}DVD Rescue\\${safeLabel}`;
    try {
      const updated = await ipc.changeOutputDir(sessionId, newDir);
      setSession(updated);
      setShowDrivePicker(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const wrap = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 py-4">
      <div className="mb-4 border-b border-ink-200/70 pb-3">
        <span className="micro-label">Output</span>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
          Lossless — exactly what was on the disc.
        </p>
      </div>

      {/* Save destination — visible + editable */}
      {session && (
        <div className="mb-5 rounded-xl border border-ink-200/70 bg-white/60 p-3">
          <div className="flex items-center gap-3">
            <span className="micro-label">Saving to</span>
            <span className="flex-1 truncate font-mono text-[12px] text-ink-700">
              {session.output_dir}
            </span>
            <button
              onClick={async () => {
                if (!showDrivePicker) await refreshDrives();
                setShowDrivePicker(!showDrivePicker);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white/90 px-3 py-1 text-[11px] font-medium text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              {showDrivePicker ? "Hide" : "Change drive"}
            </button>
          </div>
          {showDrivePicker && (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {storageDrives.length === 0 ? (
                <p className="text-[12px] text-ink-500">No drives detected.</p>
              ) : storageDrives.map((d) => {
                const isUsb = d.kind === "removable";
                return (
                  <button
                    key={d.path}
                    type="button"
                    onClick={() => useDrive(d)}
                    className="rounded-xl border border-ink-200 bg-white/80 p-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <div className="flex items-center gap-2">
                      {isUsb
                        ? <Usb className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                        : <HardDrive className="h-3.5 w-3.5 shrink-0 text-ink-500" />}
                      <span className="font-mono text-[12px] font-semibold text-ink-900">
                        {d.path.replace(/\\$/, "")}
                      </span>
                      {d.label && <span className="text-[11px] text-ink-500">· {d.label}</span>}
                      {isUsb && (
                        <span className="ml-auto rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-brand-700">
                          USB
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] tabular-nums text-ink-500">
                      {bytesToHuman(d.free_bytes)} free
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* Disc health — custom progress arc */}
        <div className="card">
          <div className="micro-label mb-3">Disc health</div>
          {health ? (
            <div className="flex items-center gap-4">
              <HealthArc score={health.score} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink-700">
                  {health.summary}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-ink-500 hover:text-ink-700">
                    Details
                  </summary>
                  <dl className="mt-2 space-y-0.5 text-[11px] text-ink-500">
                    <div>Coverage: {health.coverage_pct.toFixed(1)}%</div>
                    <div>
                      Critical files:{" "}
                      {health.critical_intact ? "intact" : "damaged"}
                    </div>
                    <div>
                      Largest unreadable run:{" "}
                      {health.largest_failed_run.toLocaleString()} sections
                    </div>
                  </dl>
                </details>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={() => wrap("health", async () => setHealth(await ipc.healthScore(sessionId)))}
              disabled={busy !== null}
            >
              {busy === "health" && <Loader2 className="h-4 w-4 animate-spin" />}
              Check disc health
            </button>
          )}
        </div>

        {/* Save your video / music */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div className="micro-label flex items-center gap-1.5">
              {isAudioCd && <Music className="h-3 w-3 text-brand-600" />}
              {isAudioCd ? "Save your music" : "Save your video"}
            </div>
            {!canSave && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-600">
                <Lock className="h-2.5 w-2.5" />
                Pro
              </span>
            )}
          </div>

          {!canSave && (
            <ProUpsellBanner />
          )}

          {/* Audio CD: only WAV extraction makes sense */}
          {isAudioCd && audioToc && (
            <div className={cn("space-y-3", !canSave && "pointer-events-none opacity-50")}>
              <button
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() =>
                  wrap("audio", async () => setAudioTracks(await ipc.extractAudioTracks(sessionId)))
                }
              >
                {busy === "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
                Save tracks as WAV
              </button>
              <div className="rounded-xl border border-ink-200/70 bg-white/60 p-3">
                <div className="micro-label mb-2">{audioToc.tracks.length} tracks · 44.1 kHz / 16-bit stereo</div>
                <ul className="space-y-1 text-[12px] text-ink-700 max-h-48 overflow-y-auto">
                  {audioToc.tracks.map((track) => (
                    <li key={track.number} className="flex justify-between font-mono">
                      <span>Track {String(track.number).padStart(2, "0")}</span>
                      <span className="tabular-nums text-ink-500">
                        {Math.floor(track.duration_secs / 60)}:
                        {String(Math.floor(track.duration_secs % 60)).padStart(2, "0")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {audioTracks && audioTracks.length > 0 && (
                <div
                  className="rounded-xl border p-3 text-[12px]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(52,199,89,0.10) 0%, rgba(52,199,89,0.04) 100%)",
                    borderColor: "rgba(52,199,89,0.30)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-ios-green">
                      ✓ {audioTracks.length} track{audioTracks.length === 1 ? "" : "s"} saved as WAV
                    </div>
                    {audioTracks[0] && (
                      <button
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-ios-green/70 hover:bg-black/5 hover:text-ios-green"
                        onClick={() => ipc.openFolder(audioTracks[0].file_path)}
                      >
                        <FolderOpen className="h-3 w-3" />
                        Open folder
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary button row — hierarchy: one bold, two quiet.
              Buttons are hidden for non-applicable disc types (e.g. MP4
              hides for data CDs; "All files" hides for DVD-Video). */}
          <div className={cn("flex flex-wrap items-center gap-2", !canSave && "pointer-events-none opacity-50")}>
            {showVideoSaves && (
              <button
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() => wrap("mp4", async () => setMp4(await ipc.saveAsMp4(sessionId)))}
              >
                {busy === "mp4" && <Loader2 className="h-4 w-4 animate-spin" />}
                <FileVideo className="h-4 w-4" />
                Save as MP4
                <span className="ml-1 text-[11px] font-normal opacity-80">instant</span>
              </button>
            )}
            {showVideoSaves && showIso && <span className="mx-1 text-ink-300">·</span>}
            {showIso && (
              <button
                className={cn(
                  "transition disabled:opacity-50",
                  showVideoSaves
                    ? "text-[13px] font-medium text-ink-700 hover:text-brand-600"
                    : "btn btn-primary",
                )}
                disabled={busy !== null}
                onClick={() => wrap("iso", async () => setIso(await ipc.createIso(sessionId)))}
              >
                {busy === "iso" ? (
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileArchive className="mr-1 inline h-3.5 w-3.5" />
                )}
                Disc image
              </button>
            )}
            {showVideoSaves && (
              <button
                className="text-[13px] font-medium text-ink-700 transition hover:text-brand-600 disabled:opacity-50"
                disabled={busy !== null}
                onClick={() =>
                  wrap("vobs", async () => setExtracted(await ipc.extractVobs(sessionId)))
                }
              >
                {busy === "vobs" ? (
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Files className="mr-1 inline h-3.5 w-3.5" />
                )}
                Individual chapters
              </button>
            )}
            {showFileSaves && (
              <>
                {showVideoSaves && <span className="mx-1 text-ink-300">·</span>}
                <button
                  className={cn(
                    "transition disabled:opacity-50",
                    showVideoSaves || showIso
                      ? "text-[13px] font-medium text-ink-700 hover:text-brand-600"
                      : "btn btn-primary",
                  )}
                  disabled={busy !== null}
                  onClick={() =>
                    wrap("all-files", async () => setExtracted(await ipc.extractAllFiles(sessionId)))
                  }
                  title="For data CDs / DVDs with photos, documents, or other files"
                >
                  {busy === "all-files" ? (
                    <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Files className="mr-1 inline h-3.5 w-3.5" />
                  )}
                  All files (photos, docs)
                </button>
              </>
            )}
          </div>

          {mp4 && (
            <div
              className="mt-4 rounded-xl border p-3 text-[12px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(52,199,89,0.10) 0%, rgba(52,199,89,0.04) 100%)",
                borderColor: "rgba(52,199,89,0.30)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-ios-green">Video saved</div>
                <button
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-ink-500 hover:bg-black/5 hover:text-ink-700"
                  onClick={() => ipc.openFolder(mp4.output_path)}
                >
                  <FolderOpen className="h-3 w-3" />
                  Show in Explorer
                </button>
              </div>
              <div className="mt-1 font-mono text-[11px] text-ink-700">{mp4.output_path}</div>
              <div className="mt-1 text-[11px] text-ink-500">
                {bytesToHuman(mp4.bytes_written)} ·{" "}
                {mp4.source_files.length} chapter{mp4.source_files.length === 1 ? "" : "s"}
              </div>
            </div>
          )}

          {iso && (
            <div className="mt-4 rounded-xl border border-ink-200 bg-white/60 p-3 text-[12px]">
              <div className="flex items-center justify-between">
                <div className="font-medium text-ink-900">Disc image saved</div>
                <button
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-ink-500 hover:bg-black/5 hover:text-ink-700"
                  onClick={() => ipc.openFolder(iso.path)}
                >
                  <FolderOpen className="h-3 w-3" />
                  Show in Explorer
                </button>
              </div>
              <div className="mt-1 font-mono text-[11px] text-ink-700">{iso.path}</div>
              <div className="mt-1 text-[11px] text-ink-500">
                {bytesToHuman(iso.bytes_written)} · {iso.good_sectors.toLocaleString()} sections
                recovered
                {iso.zero_filled_sectors > 0 &&
                  `, ${iso.zero_filled_sectors.toLocaleString()} damaged`}
              </div>
            </div>
          )}

          {extracted && (
            <div className="mt-4 rounded-xl border border-ink-200 bg-white/60 p-3 text-[12px]">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-ink-900">
                  {extracted.length} chapter file{extracted.length === 1 ? "" : "s"} saved
                </div>
                {extracted[0] && (
                  <button
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-ink-500 hover:bg-black/5 hover:text-ink-700"
                    onClick={() => ipc.openFolder(extracted[0].path)}
                  >
                    <FolderOpen className="h-3 w-3" />
                    Open folder
                  </button>
                )}
              </div>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto font-mono text-[11px]">
                {extracted.map((f) => (
                  <li key={f.path} className="flex justify-between">
                    <span className="text-ink-700">{f.name}</span>
                    <span className="text-ink-500">
                      {bytesToHuman(f.size_bytes)}
                      {f.zero_filled_sectors > 0 && (
                        <span className="ml-2 text-ios-orange">
                          ({f.zero_filled_sectors} damaged)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="mt-3 text-[13px] text-ios-red">{error}</p>}

          <div className="mt-5 border-t border-ink-200/70 pt-3">
            <details className="text-[12px] text-ink-500">
              <summary className="cursor-pointer hover:text-ink-700">
                Advanced — recovery map (.rmap) and diagnostics
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-ink-500">
                  The recovery map records which sections of the disc we read
                  successfully. Save it to continue this rescue on another
                  computer or with GNU ddrescue. Compatible with ddrescue's
                  mapfile format.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-ghost"
                    disabled={busy !== null}
                    onClick={() =>
                      wrap("rmap-export", async () => {
                        const target = await saveDialog({
                          defaultPath: `recovery-${sessionId.slice(0, 8)}.rmap`,
                          filters: [
                            { name: "Recovery map", extensions: ["rmap"] },
                            { name: "All files", extensions: ["*"] },
                          ],
                        });
                        if (typeof target === "string") {
                          setRmapExport(await ipc.exportRmap(sessionId, target));
                        }
                      })
                    }
                  >
                    {busy === "rmap-export" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Save recovery map
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy !== null}
                    onClick={() =>
                      wrap("rmap-import", async () => {
                        const picked = await openDialog({
                          multiple: false,
                          filters: [
                            { name: "Recovery map", extensions: ["rmap", "map"] },
                            { name: "All files", extensions: ["*"] },
                          ],
                        });
                        if (typeof picked === "string") {
                          setRmapImport(await ipc.importRmap(sessionId, picked));
                        }
                      })
                    }
                  >
                    {busy === "rmap-import" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    Load recovery map
                  </button>
                </div>
                {rmapExport && (
                  <div className="font-mono text-[10px] text-ink-500">
                    Saved {rmapExport.path} ({bytesToHuman(rmapExport.bytes_written)})
                  </div>
                )}
                {rmapImport && (
                  <div className="text-[11px] text-ink-700">
                    Loaded — {rmapImport.good_sectors.toLocaleString()} recovered,{" "}
                    {rmapImport.failed_sectors.toLocaleString()} damaged,{" "}
                    {rmapImport.unknown_sectors.toLocaleString()} pending
                  </div>
                )}
                <button
                  className="block text-[11px] text-ink-500 hover:text-ink-700"
                  disabled={busy !== null}
                  onClick={() =>
                    wrap("diag", async () =>
                      setDiagnostic(await ipc.exportDiagnosticBundle(sessionId)),
                    )
                  }
                >
                  {busy === "diag" ? (
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                  ) : (
                    <LifeBuoy className="mr-1 inline h-3 w-3" />
                  )}
                  Export diagnostic bundle for support
                </button>
                {diagnostic && (
                  <div className="font-mono text-[10px] text-ink-500">
                    {diagnostic.zip_path} ({bytesToHuman(diagnostic.bytes)})
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthArc({ score }: { score: number }) {
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * c;
  const color =
    clamped >= 90
      ? "#34C759"
      : clamped >= 70
        ? "#5AC8FA"
        : clamped >= 50
          ? "#FF9500"
          : "#FF3B30";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E1E6EE"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-ink-900">
        {Math.round(clamped)}
      </div>
    </div>
  );
}

/**
 * Banner shown above the (locked) Save buttons on the free tier. Explains
 * the Pro upgrade and routes to checkout / license activation.
 */
function ProUpsellBanner() {
  const [showActivate, setShowActivate] = useState(false);
  const { activate } = useLicense();
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buy = () => window.open("https://heirvo.com/buy", "_blank");

  const submit = async () => {
    if (!key.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await activate(key);
      setShowActivate(false);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="mb-3 rounded-xl border p-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(10,132,255,0.08) 0%, rgba(90,200,250,0.04) 100%)",
        borderColor: "rgba(10,132,255,0.25)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-900">
            You've recovered your video. Keep it forever for $39.
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-600">
            Heirvo Pro unlocks Save — MP4, disc image, chapters, all files.
            One-time purchase, no subscription.
          </p>
        </div>
        <button
          onClick={buy}
          className="btn btn-primary self-start text-[12px]"
        >
          Unlock Save
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 border-t border-brand-200/40 pt-2">
        <button
          onClick={() => setShowActivate(!showActivate)}
          className="text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          {showActivate ? "Hide" : "I already have a license key"}
        </button>
        {showActivate && (
          <div className="flex flex-1 items-center gap-2">
            <input
              className="flex-1 rounded-md border border-ink-200 bg-white/90 px-2 py-1 font-mono text-[11px]"
              placeholder="HEIRVO-XXXX-XXXX"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={submitting}
            />
            <button
              onClick={submit}
              disabled={!key.trim() || submitting}
              className="rounded-md bg-ink-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-ink-800 disabled:opacity-40 transition-colors"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Activate"}
            </button>
          </div>
        )}
      </div>
      {err && <p className="mt-1 text-[10px] text-ios-red">{err}</p>}
    </div>
  );
}
