// Translation helpers for the "Speak human" rule (docs/ui-ux.md).
//
// Numbers must always be presented in units the user actually thinks in:
// minutes/seconds, megabytes/gigabytes, percentages — never sectors or LBAs.

const SECTOR_BYTES = 2048;
// MPEG-2 DVD bitrate is variable but averages around 5 Mbps for home video.
// 2048 bytes/sector ÷ (5_000_000 / 8 bytes/sec) ≈ 0.0033 sec/sector
// We use a slightly conservative estimate that matches what users actually see.
const SECONDS_PER_SECTOR = 0.0034;

export function sectorsToMinutes(sectors: number): number {
  return Math.round((sectors * SECONDS_PER_SECTOR) / 60);
}

export function sectorsToBytes(sectors: number): number {
  return sectors * SECTOR_BYTES;
}

export function bytesToHuman(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(0)} MB`;
}

export function durationHuman(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/// Phrase a recovery health number in human terms.
export function healthMessage(score: number): {
  headline: string;
  tone: "success" | "partial" | "rough";
} {
  if (score >= 95) {
    return { headline: "We saved everything.", tone: "success" };
  }
  if (score >= 70) {
    return {
      headline: "We saved most of your video.",
      tone: "partial",
    };
  }
  if (score >= 30) {
    return {
      headline: "We saved what we could.",
      tone: "partial",
    };
  }
  return {
    headline: "This disc is heavily damaged.",
    tone: "rough",
  };
}

/// Phrase a recovery progress summary as a sentence.
/// Example: "Saved 38 of 47 minutes so far"
export function progressSentence(stats: {
  good: number;
  total: number;
}): string {
  const savedMin = sectorsToMinutes(stats.good);
  const totalMin = sectorsToMinutes(stats.total);
  if (totalMin === 0) return "Getting ready…";
  return `Saved ${savedMin} of ${totalMin} minutes so far`;
}
