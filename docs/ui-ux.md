# UI/UX Rules

The recovery engine is the foundation; the UX is the product.

**Core mood:** Calm reassurance. Think *a doctor, not a mechanic*. The user is scared.

## Banned words in UI (translate every one)

| ❌ Tech jargon | ✅ Human |
|---|---|
| Sector | Section of disc |
| VOB / IFO / UDF / ISO9660 | Video file |
| Bad sector | Damaged area |
| Mux / demux / transcode | Save as video file |
| Bitrate / codec | (Hide entirely from default UI) |
| Failed | We saved what we could |

## The four-screen app (don't add a fifth without strong reason)

1. **Insert disc** — auto-detect, show: disc title (from IFO), runtime, "We see X minutes of video. Ready when you are." Big single button: **Rescue this disc**.
2. **Rescuing** — live progress. Visual disc with healthy/damaged/unread regions colored in. Live counter: *"Saved: 38 minutes of video."* ETA. Pause / Eject Safely / Cancel buttons. Never shows raw sector counts unless user clicks an "advanced" disclosure.
3. **Done** — ALWAYS reassuring, never failure-framed:
   - **Best case**: *"We saved everything. 47 minutes recovered."* → [Watch] [Save to Computer] [Enhance with AI]
   - **Partial**: *"We saved 44 of 47 minutes. 3 minutes had damage we couldn't read. Want to try again? Sometimes a second try in a different drive helps."* → [Watch what we have] [Try again]
   - **Worst case**: *"This disc is heavily damaged. Here's what we got — 18 minutes of usable video. Even professional services often can't do better. Want to keep this and try a different drive?"* → never just "Failed."
4. **Enhance** (optional) — three preset cards (Light/Standard/Maximum), 30-sec preview before committing, side-by-side before/after slider.

## Health scoring

Show a single visual: **Disc health: 87%** with a colored ring. Hover/click to expand into details. Most users will never click in. That's correct.

## Wizard for the first run only

- *"Step 1 of 3: Put your disc in the drive. We'll check it for you."*
- After first successful recovery, default to single-screen mode.

## Never show

- Modal dialogs during recovery.
- Technical errors. Catch and translate everything.
- Progress that goes backward.
- Silent failures. If we can't read something, say so calmly.

## Always show

- An ETA (even an approximate one).
- A pause/cancel that actually works in <1 second.
- *"Your data is safe even if you close this app"* — make resumability visible.
