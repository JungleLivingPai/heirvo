import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * Auto-update banner.
 *
 * - Checks once on app start, then every 4 hours while the window is open.
 * - Shows a non-blocking toast in the top-right when a newer version is
 *   available; clicking "Install" downloads + installs and restarts the app.
 * - Silently no-ops if the updater plugin is unavailable (e.g. dev build,
 *   sideloaded dist) so the recovery flow is never blocked by update infra.
 */
export default function UpdateBanner() {
  const [info, setInfo] = useState<{ version: string; notes?: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const updateRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        // Lazy import — module only resolves inside Tauri webview.
        // @ts-ignore — package added to package.json; types resolve after `npm install`.
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled) return;
        if (update) {
          updateRef.current = update;
          setInfo({
            version: (update as { version: string }).version,
            notes: (update as { body?: string }).body,
          });
        }
      } catch {
        // Updater not configured / network failure — fail silently.
      }
    };

    void tick();
    // Re-check every 4 hours.
    timer = window.setInterval(tick, 4 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  const onInstall = async () => {
    if (!updateRef.current) return;
    setInstalling(true);
    try {
      const update = updateRef.current as {
        downloadAndInstall: (cb?: (e: unknown) => void) => Promise<void>;
      };
      await update.downloadAndInstall();
      // @ts-ignore — package added to package.json; types resolve after `npm install`.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("update install failed", e);
      setInstalling(false);
    }
  };

  if (!info || dismissed) return null;

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 flex justify-end">
      <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-brand-300/50 bg-white/90 px-4 py-3 shadow-xl backdrop-blur">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">
            Heirvo update available
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            Version {info.version} is ready to install.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onInstall}
              disabled={installing}
              className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-500 disabled:bg-ink-300"
            >
              {installing ? "Installing…" : "Install & restart"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg px-2 py-1 text-xs text-ink-500 hover:text-ink-700"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-ink-400 hover:text-ink-700"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
