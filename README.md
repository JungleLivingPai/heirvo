# Heirvo

> *Retrieving memories before they are lost forever.*

Recover files from scratched, damaged, or aging DVDs, photo CDs, audio CDs, and data discs — even when the disc won't play in a normal player. Built with Rust + Tauri 2 + React.

[**heirvo.com**](https://heirvo.com) · [Download](https://heirvo.com/download) · [Mail-in service](https://heirvo.com/recover)

---

## What it does

| Tier | Price | Capabilities |
|---|---|---|
| **Heirvo Free** | $0 | Recover any disc · multi-pass sector recovery · resumable sessions · view what was recovered |
| **Heirvo Pro** | $39 one-time | Save as MP4 (lossless) · save as ISO · extract chapters · recover all data files · AI restoration · priority support |
| **Mail-in service** | $89+ | Ship us the disc — we handle everything. For users without a DVD drive. |

## Repository layout

```
Heirvo/
├── src/                    React frontend (desktop app)
│   ├── app/                Routing + top-level App
│   ├── screens/            Wizard, Dashboard, Transcode, Enhancement
│   └── lib/                Typed IPC bindings, types, utilities
│
├── src-tauri/              Rust backend
│   ├── src/
│   │   ├── disc/           SCSI I/O, drive enumeration, sector reader
│   │   ├── recovery/       Sector map, multi-pass engine
│   │   ├── session/        SQLite persistence, resume logic
│   │   ├── dvd/            IFO/BUP parser
│   │   ├── media/          FFmpeg pipeline (transcode, probe)
│   │   ├── ai/             Enhancement pipeline (Real-ESRGAN, etc.)
│   │   ├── commands/       Tauri IPC handlers
│   │   └── lib.rs          Tauri builder + handler registration
│   ├── icons/              Generated icons (all sizes)
│   ├── resources/ffmpeg/   Bundled ffmpeg.exe + ffprobe.exe (gitignored)
│   ├── installer-sidebar.bmp
│   └── tauri.conf.json
│
├── marketing/              Marketing site → heirvo.com (deployed via Vercel)
│   ├── src/pages/          LandingMin1, RecoverH, Download, Activate, etc.
│   ├── src/components/     Nav, Footer, sections, etc.
│   └── public/assets/      Hero images, social-share images
│
├── assets/                 Source assets (icon.png — kintsugi disc design)
├── docs/                   Design docs (recovery engine, FFmpeg, AI, etc.)
├── scripts/                Dev scripts (fetch-ffmpeg.ps1)
├── tools/                  Test tools (synth-disc — synthetic damaged disc generator)
├── README.md, LICENSE, TESTERS.md
└── package.json
```

## Prerequisites (development)

- **Node.js** 20+
- **Rust** 1.75+ (`rustup install stable`)
- **Visual Studio Build Tools 2022** (MSVC toolchain on Windows)
- **WebView2 Runtime** (preinstalled on Windows 11)

## Quick start

```powershell
# Install JS deps
npm install

# Fetch FFmpeg binaries into src-tauri/resources/ffmpeg/ (~80 MB download, idempotent)
pwsh ./scripts/fetch-ffmpeg.ps1

# Run the desktop app in dev mode (Rust backend + Vite HMR)
npm run tauri dev

# Build a release installer (NSIS .exe in src-tauri/target/release/bundle/nsis/)
npm run tauri build
```

## Marketing site

The marketing site is in `marketing/` and deploys to [heirvo.com](https://heirvo.com) via Vercel.

```powershell
cd marketing
npm install
npm run dev      # local preview at http://localhost:5173
vercel --prod    # deploy to production (heirvo.com)
```

Required env vars (set in Vercel dashboard + `marketing/.env`):
- `VITE_FORMSPREE_ID` — Mail-in order form endpoint
- `VITE_STRIPE_INTAKE_URL` — $19.99 mail-in intake fee payment link
- `VITE_LS_CHECKOUT_URL` — Lemon Squeezy Pro license checkout URL
- `VITE_DOWNLOAD_URL` — GitHub Release installer URL

## AI features (optional `onnx` Cargo feature)

By default the app uses `MockAiBackend` for AI dispatch. To enable Real-ESRGAN inference via ONNX Runtime + DirectML:

```powershell
npm run tauri build -- --features onnx
```

ONNX models live at `%APPDATA%\com.heirvo.app\models\<model_id>.onnx`.

## Architecture

The recovery engine is modeled on GNU ddrescue's multi-pass strategy but adapted for DVD geometry. Sector reading goes through the Windows SCSI pass-through IOCTL; the engine is decoupled via the `SectorReader` trait so future macOS/Linux backends and test mocks slot in cleanly.

See [`docs/`](./docs/) for full design notes:
- [`recovery-engine.md`](./docs/recovery-engine.md) — Multi-pass strategy
- [`dvd-video.md`](./docs/dvd-video.md) — DVD-Video format handling
- [`ffmpeg-pipeline.md`](./docs/ffmpeg-pipeline.md) — Transcode pipeline
- [`ai-restoration.md`](./docs/ai-restoration.md) — Enhancement pipeline
- [`windows-native.md`](./docs/windows-native.md) — SCSI pass-through quirks
- [`product-vision.md`](./docs/product-vision.md) — Long-term direction

## License

See [LICENSE](./LICENSE). Heirvo bundles FFmpeg under LGPL-2.1+ as a separate binary (no static linking). The app does not include CSS decryption or DRM-circumvention features — it is positioned as a recovery tool for discs the user owns.
