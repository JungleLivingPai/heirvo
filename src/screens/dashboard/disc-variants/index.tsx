import { DiscAnimation } from "../DiscAnimation";
import VinylRecord from "./VinylRecord";
import Constellation from "./Constellation";
import CRTScanline from "./CRTScanline";
import CrystalLens from "./CrystalLens";
import VisionGlass from "./VisionGlass";
import ActivityRing from "./ActivityRing";
import ActivityRingMeditative from "./ActivityRingMeditative";
import ActivityRingAchievement from "./ActivityRingAchievement";
import ActivityRingCinematic from "./ActivityRingCinematic";
import NowPlaying from "./NowPlaying";

export type VariantId =
  | "default"
  | "vinyl"
  | "constellation"
  | "crt"
  | "crystal"
  | "vision"
  | "activity"
  | "activity-meditative"
  | "activity-achievement"
  | "activity-cinematic"
  | "nowplaying";

/**
 * Real per-state sector counts. Optional so variants that don't care about
 * the breakdown (most of them) can ignore it; ActivityRing uses it to
 * render meaningful Recovered/Damaged/Scanned rings.
 */
export interface VariantStats {
  good: number;
  failed: number;
  skipped: number;
  unknown: number;
}

interface RendererProps {
  variant: VariantId;
  buckets: number[];
  totalSectors: number;
  isActive: boolean;
  pct: number;
  /** Per-state counts. Falsy → variant should fall back to pct only. */
  stats?: VariantStats | null;
}

interface VariantMeta {
  id: VariantId;
  label: string;
  swatch: string; // background gradient for thumbnail
  ringColor: string; // tiny ring color for thumbnail
}

export const VARIANTS: VariantMeta[] = [
  {
    id: "default",
    label: "Classic",
    swatch:
      "linear-gradient(135deg, #F4F7FB 0%, #E1E6EE 100%)",
    ringColor: "#0A84FF",
  },
  {
    id: "vinyl",
    label: "Vinyl",
    swatch: "linear-gradient(135deg, #1a1f2b 0%, #05070b 100%)",
    ringColor: "#5AC8FA",
  },
  {
    id: "constellation",
    label: "Star Map",
    swatch: "radial-gradient(closest-side, #1a2540 0%, #060a14 100%)",
    ringColor: "#5AC8FA",
  },
  {
    id: "crt",
    label: "VHS",
    swatch:
      "radial-gradient(closest-side, #0E1722 0%, #060A12 100%)",
    ringColor: "#34C759",
  },
  {
    id: "crystal",
    label: "Crystal",
    swatch:
      "radial-gradient(closest-side, #F4FBFF 0%, #A8C7E0 100%)",
    ringColor: "#0A84FF",
  },
  {
    id: "vision",
    label: "Vision",
    swatch:
      "radial-gradient(closest-side, rgba(10,132,255,0.45) 0%, rgba(90,200,250,0.18) 60%, transparent 100%)",
    ringColor: "#5AC8FA",
  },
  {
    id: "activity",
    label: "Activity",
    swatch: "radial-gradient(closest-side, #1A2540 0%, #04091A 100%)",
    ringColor: "#34C759",
  },
  {
    id: "activity-meditative",
    label: "Meditative",
    swatch: "radial-gradient(closest-side, #0E2335 0%, #04101A 100%)",
    ringColor: "#5AC8FA",
  },
  {
    id: "activity-achievement",
    label: "Achievement",
    swatch: "radial-gradient(closest-side, #1F2A40 0%, #04091A 100%)",
    ringColor: "#FFD60A",
  },
  {
    id: "activity-cinematic",
    label: "Cinematic",
    swatch: "radial-gradient(closest-side, #1A2540 0%, #06091A 100%)",
    ringColor: "#A78BFA",
  },
  {
    id: "nowplaying",
    label: "Now Playing",
    swatch: "linear-gradient(180deg, #FAFCFF 0%, #D8E1EC 100%)",
    ringColor: "#0A84FF",
  },
];

export function DiscVariantRenderer({
  variant,
  buckets,
  totalSectors,
  isActive,
  pct,
  stats,
}: RendererProps) {
  const props = { buckets, totalSectors, isActive, pct };
  switch (variant) {
    case "vinyl":
      return <VinylRecord {...props} />;
    case "constellation":
      return <Constellation {...props} />;
    case "crt":
      return <CRTScanline {...props} />;
    case "crystal":
      return <CrystalLens {...props} />;
    case "vision":
      return <VisionGlass {...props} />;
    case "activity":
      return <ActivityRing {...props} stats={stats} />;
    case "activity-meditative":
      return <ActivityRingMeditative {...props} stats={stats} />;
    case "activity-achievement":
      return <ActivityRingAchievement {...props} stats={stats} />;
    case "activity-cinematic":
      return <ActivityRingCinematic {...props} stats={stats} />;
    case "nowplaying":
      return <NowPlaying {...props} />;
    case "default":
    default:
      return <DiscAnimation {...props} />;
  }
}

interface PickerProps {
  value: VariantId;
  onChange: (id: VariantId) => void;
}

export function DiscVariantPicker({ value, onChange }: PickerProps) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-full"
      style={{
        background: "rgba(10, 23, 41, 0.04)",
        border: "1px solid rgba(10, 23, 41, 0.08)",
        backdropFilter: "blur(6px)",
      }}
      role="tablist"
      aria-label="Disc visualization style"
    >
      {VARIANTS.map((v) => {
        const active = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.id)}
            className="group relative flex items-center gap-2 px-3 py-1.5 rounded-full transition-all"
            style={{
              background: active
                ? "linear-gradient(180deg, #0A84FF 0%, #0066CC 100%)"
                : "transparent",
              color: active ? "#FFFFFF" : "#5C6B82",
              boxShadow: active
                ? "0 4px 12px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)"
                : "none",
              cursor: "pointer",
              minHeight: 32,
            }}
          >
            {/* Tiny disc swatch */}
            <span
              aria-hidden
              className="inline-block rounded-full"
              style={{
                width: 14,
                height: 14,
                background: v.swatch,
                border: `1.5px solid ${active ? "#FFFFFF" : v.ringColor}`,
                boxShadow: active
                  ? "0 0 0 1px rgba(255,255,255,0.4)"
                  : "inset 0 0 0 1px rgba(10,23,41,0.06)",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                letterSpacing: "0.02em",
              }}
            >
              {v.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
