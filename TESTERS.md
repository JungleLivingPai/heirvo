# Heirvo — Tester quick-start

Welcome. Thank you for trying Heirvo on a real damaged disc — your feedback is what shapes v1.

## Install (Windows)

1. Copy `Heirvo_0.1.0_x64-setup.exe` from your USB stick to the test machine
2. Double-click to install. Windows SmartScreen may warn:
   > Windows protected your PC
   > Microsoft Defender SmartScreen prevented an unrecognized app...
3. Click **More info** → **Run anyway**. (We're not yet code-signed — that's coming with the public launch.)
4. Install proceeds. Launch Heirvo from the Start menu.

## What this app does — and what it doesn't

**Does:** rescues data from damaged DVD-Video discs, photo CDs, document CDs, and other readable optical media. Even if Windows says "this disc is unreadable," Heirvo can usually recover most of the content.

**Doesn't:** copy commercial DVDs (CSS-protected). Capture VHS or other tape media (that's a separate workflow on the roadmap).

## The flow you'll test

1. **Insert your DVD or CD** into the optical drive.
2. **Click "Rescue a disc"** on the home screen.
3. **Wizard steps:**
   - Step 1: pick the optical drive (auto-selected if there's only one)
   - Step 2: probe the disc — Heirvo reads its filesystem and reports what's on it
   - Step 3: **save destination** — see all available drives. Pick a USB stick or external HDD if your computer's drive is full
   - Step 4: pick **Standard** or **Patient** mode
4. **Recovery runs.** Watch the disc animation, sector map, and stat tiles update live.
5. **Pause / Resume** any time. Progress is saved automatically — close the app, come back tomorrow.
6. **When done:** save to MP4, ISO image, or extract individual chapters / files.

## Standard vs Patient — when to use which

| | Standard | Patient |
|---|---|---|
| Best for | Healthy desktop drives, lightly scratched discs | Bus-powered USB drives, badly damaged discs |
| Speed | 30–60 minutes typical | Hours, sometimes overnight |
| What it does | 4 passes: fast triage → slow retry → reverse → thermal pause | Sector-by-sector with 2s rest between reads. Skips the fast block triage that often crashes weak drives. |
| Pick this if | You have a powered drive and want it done | You're seeing disconnect/brownout errors, or your drive is plugged into a USB port that can't deliver enough power |

If your drive keeps disconnecting in Standard mode, switch to Patient. If everything's been quiet for an hour and you're not making progress, switch back to Standard.

## What the colors on the disc mean

- **Green** — recovered cleanly
- **Red** — failed (we'll retry on later passes)
- **Orange** — skipped (we read past it for now, will revisit)
- **Light gray** — not yet read

## License (pre-launch tester mode)

The Save buttons are gated behind Heirvo Pro ($39 one-time, no subscription).
**For testing:** paste any license key matching `XXXX-XXXX-XXXX` (8+ chars, at least one dash). Example: `TEST-PRO-1234`. This is a development gate — the production build will validate against the real license server.

To activate:
1. Try to save a recovered file
2. The Pro upsell banner appears
3. Click **"I already have a license key"**
4. Paste `TEST-PRO-1234` (or any well-formed dummy)
5. Click **Activate** — Save buttons unlock

## What we want to know

After your test, please tell us:

1. **Did your damaged disc come back?** Roughly what % did we recover?
2. **Did the drive disconnect** during recovery? How often? Did Patient mode help?
3. **Did the USB output picker work?** Showed your USB stick with correct free space?
4. **What was confusing?** Any moment where you weren't sure what to click?
5. **What was missing?** Any feature you wished existed?
6. **Did the file you recovered actually play?** (MP4 in any media player.)

You can email feedback to the address you were given, or capture screenshots and attach them.

## Where your data lives

Everything Heirvo writes is on **your computer only.** No uploads, no telemetry, no phoning home. You can verify by inspecting the network panel of your firewall during a recovery — it'll be silent.

Recovery files (ISO, VOBs, MP4) go where you told them to in the Wizard's Save destination step. App data (logs, the SQLite session DB) lives at:
```
C:\Users\<you>\AppData\Roaming\com.heirvo.app\
```

If you want to nuke everything Heirvo knows, delete that folder. The app starts fresh next launch.

## New in this build

- **Audio CD recovery** — rescues CD-DA music discs and saves each track as a lossless WAV
- **Show in Explorer** — after saving a file, click "Show in Explorer" to jump straight to it in File Explorer
- **Retry failed sectors** — once recovery finishes, if any sectors failed a "Retry N failed sectors" button appears. Click it to re-run Patient mode on just the bad sectors — no need to restart from scratch
- **Session names** — in the Sessions list, hover over a session and click the pencil icon to give it a friendly name like "Mom Wedding 1998"
- **Recovery notification** — Windows will notify you when the recovery finishes, so you can step away while it runs

## Known limitations in this build

- VHS / capture-card workflows are roadmapped for v2
- AI restoration (upscale, deinterlace, denoise) is wired but currently runs a mock — real ONNX backend lands before public launch
- Code signing / notarization not yet in place (the SmartScreen warning above)

Thanks again for testing.

— Heirvo
