/**
 * Simplified hero version of the in-app DiscAnimation.
 * 360 sectors mostly green/cyan with a few amber/red "damaged" ones,
 * plus a sweeping read arm.
 */
const SIZE = 340;
const C = SIZE / 2;
const R_OUT = 158;
const R_IN = 116;
const SEG = 120;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arc(cx: number, cy: number, ro: number, ri: number, s: number, e: number) {
  const p1 = polar(cx, cy, ro, e);
  const p2 = polar(cx, cy, ro, s);
  const p3 = polar(cx, cy, ri, s);
  const p4 = polar(cx, cy, ri, e);
  return `M ${p1.x} ${p1.y} A ${ro} ${ro} 0 0 0 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${ri} ${ri} 0 0 1 ${p4.x} ${p4.y} Z`;
}

// Pre-baked sector states — mostly recovered with small damaged regions
const STATES = (() => {
  const arr: ("good" | "fail" | "skip" | "unknown")[] = [];
  for (let i = 0; i < SEG; i++) {
    if (i >= 8 && i <= 12) arr.push("fail");
    else if (i >= 38 && i <= 41) arr.push("skip");
    else if (i >= 84 && i <= 86) arr.push("fail");
    else if (i >= 100 && i <= 102) arr.push("skip");
    else if (i % 17 === 0) arr.push("unknown");
    else arr.push("good");
  }
  return arr;
})();

const COLORS = {
  good: "#34C759",
  fail: "#FF3B30",
  skip: "#FF9500",
  unknown: "#E1E6EE",
} as const;

export function HeroDisc() {
  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE }}
      aria-hidden
    >
      {/* Soft cyan glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 animate-breathe"
        style={{
          background:
            "radial-gradient(closest-side, rgba(10,132,255,0.30), rgba(90,200,250,0.16) 50%, transparent 75%)",
          filter: "blur(12px)",
        }}
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ filter: "drop-shadow(0 18px 38px rgba(10,23,41,0.14))" }}
      >
        <defs>
          <linearGradient id="armG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#5AC8FA" />
          </linearGradient>
          <radialGradient id="hub" cx="0.5" cy="0.35" r="0.7">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#F4F6FA" />
          </radialGradient>
          <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#5AC8FA" />
          </linearGradient>
        </defs>

        <circle cx={C} cy={C} r={R_OUT + 5} fill="none" stroke="#E1E6EE" strokeWidth={1} />

        {/* Sector ring */}
        <g>
          {STATES.map((st, i) => {
            const step = 360 / SEG;
            const s = i * step;
            const e = s + step - 0.001;
            return <path key={i} d={arc(C, C, R_OUT, R_IN, s, e)} fill={COLORS[st]} />;
          })}
        </g>

        <circle
          cx={C}
          cy={C}
          r={R_OUT + 1}
          fill="none"
          stroke="url(#ringG)"
          strokeWidth={1.5}
          opacity={0.85}
        />
        <circle cx={C} cy={C} r={R_IN - 1} fill="none" stroke="#E1E6EE" strokeWidth={1} />

        {/* Sweeping arm */}
        <g
          style={{
            transformOrigin: `${C}px ${C}px`,
            animation: "armSweep 7s linear infinite",
          }}
        >
          <line
            x1={C}
            y1={C - 26}
            x2={C}
            y2={C - (R_IN - 6)}
            stroke="url(#armG)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx={C} cy={C - (R_IN - 6)} r={5} fill="url(#armG)" />
        </g>

        {/* Hub */}
        <circle
          cx={C}
          cy={C}
          r={26}
          fill="url(#hub)"
          stroke="#E1E6EE"
          strokeWidth={1}
        />
        <circle cx={C} cy={C} r={6} fill="#0A84FF" />
      </svg>

      {/* Center % readout */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5">
          <span
            className="font-display font-bold tabular-nums tracking-tightest text-brand-600"
            style={{ fontSize: 56, lineHeight: 1 }}
          >
            94
          </span>
          <span className="font-display font-semibold text-brand-600 text-2xl">%</span>
        </div>
        <div className="micro-label mt-2">Recovered</div>
      </div>

      <style>{`
        @keyframes armSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
