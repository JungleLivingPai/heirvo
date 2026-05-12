import { useEffect, useRef } from "react";
import { SECTOR_STATE } from "@/lib/types";

// Slightly desaturated tones for visual hierarchy — green stays vivid (the win),
// failed/skipped recede so the eye reads "mostly recovered" first.
const COLORS: Record<number, string> = {
  [SECTOR_STATE.Unknown]: "#E6EBF3",
  [SECTOR_STATE.Good]: "#34C759",
  [SECTOR_STATE.Failed]: "#E66A62",
  [SECTOR_STATE.Skipped]: "#E0A04A",
};

export function SectorMapCanvas({ buckets }: { buckets: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = 120;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Cool white background
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if (buckets.length === 0) return;

    const cols = Math.min(buckets.length, 512);
    const rows = Math.ceil(buckets.length / cols);
    const cellW = cssWidth / cols;
    const cellH = cssHeight / rows;

    for (let i = 0; i < buckets.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      ctx.fillStyle = COLORS[buckets[i]] ?? COLORS[SECTOR_STATE.Unknown];
      ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }

    // Perimeter scan-position indicator — last non-Unknown bucket
    let scanIdx = -1;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (buckets[i] !== SECTOR_STATE.Unknown) {
        scanIdx = i;
        break;
      }
    }
    if (scanIdx >= 0) {
      const x = (scanIdx / Math.max(1, buckets.length - 1)) * cssWidth;
      ctx.strokeStyle = "#0A84FF";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(Math.min(cssWidth - 0.5, Math.max(0.5, x)), 0);
      ctx.lineTo(Math.min(cssWidth - 0.5, Math.max(0.5, x)), cssHeight);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [buckets]);

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          border: "1px solid #D9DFEA",
          background: "#F8FAFC",
          boxShadow:
            "inset 0 2px 4px rgba(10,23,41,0.08), inset 0 -1px 0 rgba(255,255,255,0.6)",
        }}
      >
        <canvas ref={canvasRef} className="block w-full" />
        {/* Subtle inner top-edge highlight for the recessed feel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: "inset 0 1px 0 rgba(10,23,41,0.06)",
          }}
        />
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-ink-500">
        <Legend color={COLORS[SECTOR_STATE.Good]} label="Recovered" />
        <Legend color={COLORS[SECTOR_STATE.Failed]} label="Failed" />
        <Legend color={COLORS[SECTOR_STATE.Skipped]} label="Skipped" />
        <Legend color={COLORS[SECTOR_STATE.Unknown]} label="Pending" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-md"
        style={{ background: color, boxShadow: "inset 0 0 0 1px rgba(10,23,41,0.06)" }}
      />
      {label}
    </span>
  );
}
