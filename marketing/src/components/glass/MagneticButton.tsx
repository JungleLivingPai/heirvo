import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import gsap from "gsap";

type Variant = "primary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  strength?: number;
}

/**
 * Magnetic button — the cursor pulls the button toward it on hover.
 * Inspired by Linear / Apple product page CTAs. Respects prefers-reduced-motion.
 */
const MagneticButton = forwardRef<HTMLButtonElement, Props>(function Mag(
  { children, variant = "primary", strength = 0.35, className = "", ...rest },
  forwardedRef
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const label = labelRef.current;
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const lxTo = label
        ? gsap.quickTo(label, "x", { duration: 0.6, ease: "power3.out" })
        : null;
      const lyTo = label
        ? gsap.quickTo(label, "y", { duration: 0.6, ease: "power3.out" })
        : null;

      const onMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        xTo(x * strength);
        yTo(y * strength);
        lxTo?.(x * strength * 0.4);
        lyTo?.(y * strength * 0.4);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
        lxTo?.(0);
        lyTo?.(0);
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      };
    }, el);

    return () => ctx.revert();
  }, [strength]);

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium tracking-tight transition-colors will-change-transform select-none";
  const styles =
    variant === "primary"
      ? "text-white bg-gradient-to-b from-[#3AA0FF] to-[#0A84FF] shadow-[0_8px_30px_-8px_rgba(10,132,255,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-[#4DAEFF] hover:to-[#1A8FFF]"
      : "text-white/90 bg-white/[0.06] border border-white/10 backdrop-blur-xl hover:bg-white/[0.10] hover:text-white";

  return (
    <button
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      className={`${base} ${styles} ${className}`}
      {...rest}
    >
      <span ref={labelRef} className="inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
});

export default MagneticButton;
