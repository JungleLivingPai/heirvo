/**
 * Lemon Squeezy overlay checkout helper.
 *
 * --- Setup ---
 * 1. Create a product in Lemon Squeezy and copy its checkout URL.
 *    It looks like: https://heirvo.lemonsqueezy.com/checkout/buy/<uuid>
 * 2. In your local environment, set:
 *      VITE_LS_CHECKOUT_URL="https://heirvo.lemonsqueezy.com/checkout/buy/<uuid>"
 *    (e.g. in `marketing/.env.local`). The same variable should be set in the
 *    Vercel/host environment for production deploys.
 * 3. If `VITE_LS_CHECKOUT_URL` still contains the placeholder string
 *    "replace-me", `isLemonSqueezyConfigured()` returns false and the Buy
 *    button on the marketing site should disable itself / show a fallback
 *    label instead of opening checkout.
 *
 * --- How it works ---
 * Lemon Squeezy ships a small script (`lemon.js`) that turns checkout URLs
 * into a modal overlay so users never leave your site. We load it lazily on
 * the first call to `openLemonCheckout()` so that visitors who never click
 * the Buy button never pay the JS cost.
 *
 * Docs: https://docs.lemonsqueezy.com/help/lemonjs/what-is-lemonjs
 */

const LEMON_JS_SRC = "https://app.lemonsqueezy.com/js/lemon.js";

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: {
      Url?: {
        Open: (url: string) => void;
        Close?: () => void;
      };
      Setup?: (opts: Record<string, unknown>) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * Whether the Lemon Squeezy checkout URL has been configured.
 * Treats the literal placeholder URL (anything containing "replace-me") as
 * unconfigured so the site doesn't break before the real product exists.
 */
export function isLemonSqueezyConfigured(url?: string): boolean {
  const target = url ?? import.meta.env.VITE_LS_CHECKOUT_URL ?? "";
  if (!target) return false;
  if (target.includes("replace-me")) return false;
  try {
    const u = new URL(target);
    return u.protocol === "https:" && u.hostname.endsWith("lemonsqueezy.com");
  } catch {
    return false;
  }
}

/**
 * Lazily load the lemon.js script and initialize the global LemonSqueezy
 * object. Subsequent calls reuse the same promise.
 */
export function loadLemonSqueezy(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    // If already loaded by index.html or an earlier call, just init.
    if (window.LemonSqueezy?.Url?.Open) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${LEMON_JS_SRC}"]`
    );

    const init = () => {
      try {
        window.createLemonSqueezy?.();
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    if (existing) {
      if (existing.dataset.loaded === "true") {
        init();
      } else {
        existing.addEventListener("load", init, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load lemon.js")),
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = LEMON_JS_SRC;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        init();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load lemon.js")),
      { once: true }
    );
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Open the Lemon Squeezy overlay checkout for the given product URL.
 * If the script can't load or the overlay isn't available, falls back to
 * navigating to the checkout in a new tab so the purchase still completes.
 */
export async function openLemonCheckout(url: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isLemonSqueezyConfigured(url)) {
    console.warn("[lemon-squeezy] checkout URL is not configured:", url);
    return;
  }

  try {
    await loadLemonSqueezy();
    if (window.LemonSqueezy?.Url?.Open) {
      window.LemonSqueezy.Url.Open(url);
      return;
    }
    throw new Error("LemonSqueezy global not available after load");
  } catch (err) {
    console.warn("[lemon-squeezy] overlay unavailable, falling back:", err);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
