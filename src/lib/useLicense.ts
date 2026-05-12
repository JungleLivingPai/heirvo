import { useEffect, useState, useCallback } from "react";
import { ipc } from "./ipc";
import type { LicenseStatus } from "./types";

const DEFAULT: LicenseStatus = { plan: "free", holder: null, can_save: false };

/**
 * useLicense — read + mutate the freemium license state.
 *
 * Returns the current status, plus `activate(key)` and `deactivate()` to
 * change it. The cache is hot — backend caches on its side too — so calling
 * this from many components is cheap.
 */
export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ipc.getLicenseStatus()
      .then((s) => { if (!cancelled) { setStatus(s); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setStatus(DEFAULT); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  const activate = useCallback(async (key: string) => {
    const next = await ipc.activateLicense(key);
    setStatus(next);
    return next;
  }, []);

  const deactivate = useCallback(async () => {
    const next = await ipc.deactivateLicense();
    setStatus(next);
    return next;
  }, []);

  return { status, loaded, activate, deactivate };
}
