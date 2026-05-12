import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import type { RefObject } from "react";

let registered = false;
function ensureRegistered() {
  if (!registered) {
    try {
      gsap.registerPlugin(SplitText);
    } catch {
      /* ignore */
    }
    registered = true;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface StaggerOpts {
  y?: number;
  duration?: number;
  stagger?: number;
  delay?: number;
}

export function staggerReveal(
  scopeRef: RefObject<HTMLElement> | HTMLElement | null,
  selector: string,
  opts: StaggerOpts = {},
) {
  ensureRegistered();
  const scope =
    scopeRef && "current" in (scopeRef as RefObject<HTMLElement>)
      ? (scopeRef as RefObject<HTMLElement>).current
      : (scopeRef as HTMLElement | null);
  if (!scope) return;
  const targets = scope.querySelectorAll(selector);
  if (targets.length === 0) return;
  if (prefersReducedMotion()) {
    gsap.set(targets, { y: 0, opacity: 1, clearProps: "transform,opacity" });
    return;
  }
  gsap.fromTo(
    targets,
    { y: opts.y ?? 24, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: opts.duration ?? 0.7,
      stagger: opts.stagger ?? 0.08,
      delay: opts.delay ?? 0,
      ease: "power3.out",
      clearProps: "transform",
    },
  );
}

export function headingReveal(el: HTMLElement | null) {
  ensureRegistered();
  if (!el) return;
  if (prefersReducedMotion()) {
    gsap.set(el, { opacity: 1 });
    return;
  }
  let split: SplitText | null = null;
  try {
    split = new SplitText(el, { type: "words" });
  } catch {
    /* SplitText may not be licensed; fall back to simple fade */
  }
  if (split && split.words && split.words.length > 0) {
    gsap.set(split.words, { transformPerspective: 600, transformOrigin: "50% 100%" });
    gsap.fromTo(
      split.words,
      { y: 20, opacity: 0, rotationX: -30 },
      {
        y: 0,
        opacity: 1,
        rotationX: 0,
        duration: 0.85,
        stagger: 0.045,
        delay: 0.15,
        ease: "power3.out",
      },
    );
  } else {
    gsap.fromTo(
      el,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, delay: 0.15, ease: "power3.out" },
    );
  }
}

export function countUp(
  el: HTMLElement | null,
  target: number,
  duration: number = 1.2,
) {
  if (!el) return;
  if (prefersReducedMotion()) {
    el.textContent = Math.round(target).toLocaleString();
    return;
  }
  const startRaw = parseFloat((el.textContent ?? "0").replace(/[^0-9.\-]/g, ""));
  const start = Number.isFinite(startRaw) ? startRaw : 0;
  const obj = { value: start };
  gsap.to(obj, {
    value: target,
    duration,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = Math.round(obj.value).toLocaleString();
    },
  });
}

/**
 * Spawn a brief sparkle burst from the center of `el` — used as a
 * celebration moment when recovery completes successfully. Sparkles are
 * absolutely-positioned children that fan out, fade, and clean themselves up.
 * No-op on reduced-motion.
 */
export function sparkleBurst(el: HTMLElement | null, count = 14) {
  if (!el) return;
  if (prefersReducedMotion()) return;

  // Ensure host is a positioning context.
  const cs = getComputedStyle(el);
  if (cs.position === "static") {
    el.style.position = "relative";
  }

  const colors = ["#FFD60A", "#34C759", "#0A84FF", "#FF9500"];
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:5";
  el.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    const size = 4 + Math.random() * 5;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 70 + Math.random() * 70;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const color = colors[i % colors.length];
    dot.style.cssText = `
      position:absolute;left:50%;top:50%;
      width:${size}px;height:${size}px;
      margin-left:-${size / 2}px;margin-top:-${size / 2}px;
      background:${color};
      border-radius:9999px;
      box-shadow:0 0 12px ${color};
      opacity:0;
      will-change:transform,opacity;
    `;
    layer.appendChild(dot);
    gsap.fromTo(
      dot,
      { x: 0, y: 0, scale: 0, opacity: 1 },
      {
        x: dx,
        y: dy,
        scale: 1,
        opacity: 0,
        duration: 0.9 + Math.random() * 0.4,
        ease: "power2.out",
      },
    );
  }

  // Clean up the layer after the longest animation finishes.
  gsap.delayedCall(1.6, () => {
    layer.parentNode?.removeChild(layer);
  });
}

/**
 * Soft pulse-in: scales `el` from 0.94 → 1 with a brief glow halo behind it.
 * Used for celebratory banner entrances. No-op on reduced-motion (just shows it).
 */
export function pulseIn(el: HTMLElement | null) {
  if (!el) return;
  if (prefersReducedMotion()) {
    gsap.set(el, { opacity: 1, scale: 1 });
    return;
  }
  gsap.fromTo(
    el,
    { opacity: 0, scale: 0.94, y: 6 },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.7,
      ease: "back.out(1.4)",
    },
  );
}

/**
 * Continuous gentle shimmer — alternates opacity between 0.55 and 1 forever.
 * Returns a kill function. Used for skeleton/placeholder states (e.g. "0 min"
 * before the first progress event arrives).
 */
export function startShimmer(el: HTMLElement | null): () => void {
  if (!el) return () => {};
  if (prefersReducedMotion()) return () => {};
  const tween = gsap.to(el, {
    opacity: 0.55,
    duration: 0.9,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });
  return () => {
    tween.kill();
    gsap.set(el, { opacity: 1 });
  };
}
