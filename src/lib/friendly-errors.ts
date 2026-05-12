/**
 * Translate raw backend / OS errors into warm, plain-English copy for the
 * UI. The goal is reassurance, not technical accuracy — most users have no
 * idea what `0x80070002` or `CreateFileW` mean, and seeing those strings
 * during an emotional moment (recovering family memories) makes the app
 * feel hostile.
 *
 * Always returns at minimum a short headline. If the original error has
 * useful detail beyond a recognized pattern, we surface it as `hint`.
 */
export type FriendlyError = {
  headline: string;
  hint?: string;
};

/**
 * Best-effort translation. Unknown errors get a generic "Something went
 * wrong" with the original message as a hint, so power users still see
 * the raw text without it being the primary message.
 */
export function friendlyError(raw: unknown): FriendlyError {
  const s = String(raw ?? "").trim();
  const lower = s.toLowerCase();

  // Windows: file/path not found (drive ejected, drive letter changed, etc.)
  if (lower.includes("0x80070002") || lower.includes("cannot find the file")) {
    return {
      headline: "We can't find the drive right now.",
      hint:
        "It may have been ejected or the drive letter changed. Plug the drive back in (or pick a different one) and try again.",
    };
  }

  // Windows: access denied — usually means another app has the drive.
  if (lower.includes("0x80070005") || lower.includes("access is denied")) {
    return {
      headline: "Another program is using the drive.",
      hint:
        "Close any media player, file explorer window, or backup tool that might be reading the disc, then try again.",
    };
  }

  // Windows: device not ready — disc not yet spun up, or empty.
  if (lower.includes("0x80070015") || lower.includes("device is not ready")) {
    return {
      headline: "The drive isn't ready yet.",
      hint:
        "Make sure a disc is inserted and give it a moment to spin up, then try again.",
    };
  }

  // Network errors during FFmpeg / model download.
  if (lower.includes("error sending request") || lower.includes("failed to lookup")) {
    return {
      headline: "Can't reach the download server.",
      hint:
        "Check your internet connection and try again. If you're behind a corporate firewall, this download may be blocked.",
    };
  }

  // SCSI / IO read errors during recovery itself.
  if (lower.includes("scsi") && lower.includes("error")) {
    return {
      headline: "The drive had trouble reading.",
      hint:
        "This is normal for damaged discs — we'll keep retrying. If it doesn't recover, switching to a different drive often helps.",
    };
  }

  // Disk space.
  if (lower.includes("no space") || lower.includes("disk full")) {
    return {
      headline: "There's no room left on that drive.",
      hint:
        "Pick a destination with more free space, or delete something first.",
    };
  }

  // Permission / read-only output.
  if (lower.includes("permission denied") || lower.includes("read-only")) {
    return {
      headline: "We can't write there.",
      hint:
        "The destination folder is read-only. Pick a different folder we can write to.",
    };
  }

  // Generic fallback — keep raw text as a hint so power users can self-diagnose.
  return {
    headline: "Something went wrong.",
    hint: s.length > 0 && s.length < 240 ? s : undefined,
  };
}
