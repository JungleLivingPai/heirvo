# Recovery Engine

This is the moat. Spend disproportionate engineering time here.

**Core philosophy:** A scratched disc is not a binary "works/doesn't work." It is a probability map. We read what we can, mark what we can't, and try again later — possibly in a different drive, possibly after the user cleans the disc.

## Recovery map file (.rmap)

- Persistent file alongside the output that tracks every sector: unread, bad, good, rescued-on-pass-N.
- Survives crashes, drive swaps, sessions weeks apart.
- Lets the user eject the disc, polish it, put it back, and continue.
- Inspired by GNU ddrescue (study its mapfile format — proven over 20+ years).

## Multi-pass strategy (mandatory)

| Pass | Strategy | Notes |
|---|---|---|
| 1 | **Fast skim** | Read every sector with retries=0. Mark bad sectors. Get to a playable file FAST — user sees a result in minutes, not hours. |
| 2 | **Targeted retry** | Only the bad sectors. Increased retries, lower drive speed. |
| 3 | **Reverse direction** | Read bad sectors from end-to-start (different head movement = sometimes works). |
| 4 | **Drive switch** | Prompt: *"Try a different DVD drive? Recovery will continue from where it left off."* Different drives have wildly different read tolerances. |

## Bad sector handling

- **NEVER hang.** Use Windows `DeviceIoControl` with explicit timeouts, hard-kill the read after N seconds.
- **Detect drive lockup.** Kill, re-init, continue.
- **Power-cycle prompt** if the drive becomes unresponsive.

## Partial file rebuilding

- A VOB with a missing 2-second chunk should still play. Most DVD players already handle this. Our muxer must too.
- Output: write a transport stream that gracefully skips holes rather than aborts.

## Damaged filesystem tolerance

- If UDF/ISO9660 directory tables are unreadable, **fall back to signature-based scanning** for VOB/IFO/BUP files (look for `DVDVIDEO` magic bytes, MPEG2 program stream sync `0x000001BA`).
- Inspired by IsoBuster's "find missing files and folders" — but **on by default**, not buried in a menu.

## Always interruptible

- Cancel button works in <1 second. Always.
- Closing the app mid-recovery saves the map. Reopening offers to resume.
