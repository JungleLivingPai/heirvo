interface Props {
  size?: number;
  className?: string;
}

/**
 * Heirvo BrandMark — gradient rounded square with a circle and vertical
 * recovery-arm light track. Mirrors the in-app icon style.
 */
export function BrandMark({ size = 36, className = "" }: Props) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl shadow-glow-blue ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: "linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)",
      }}
      aria-label="Heirvo"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="12" cy="12" r="8.25" stroke="white" strokeWidth="1.4" opacity="0.95" />
        <circle cx="12" cy="12" r="2.4" fill="white" />
        <line
          x1="12"
          y1="3.75"
          x2="12"
          y2="9.6"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
