import type { ReactNode, HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
}

/**
 * Vibrancy / frosted-glass panel for the dark theme.
 * Layered: subtle gradient border + backdrop blur + inner highlight + drop shadow.
 */
export default function GlassCard({
  children,
  hoverable = false,
  className = "",
  ...rest
}: Props) {
  return (
    <div
      {...rest}
      className={`relative rounded-3xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-30px_rgba(0,0,0,0.6)] ${
        hoverable
          ? "transition duration-500 hover:bg-white/[0.055] hover:border-white/[0.14] hover:-translate-y-1"
          : ""
      } ${className}`}
    >
      {/* gradient hairline top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.18) 60%, transparent)",
        }}
      />
      {children}
    </div>
  );
}
