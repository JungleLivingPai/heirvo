# Heirvo

> *Retrieving memories before they are lost forever.*

Rescue irreplaceable home video DVDs and photo CDs — even when they won't play. Built with Rust + Tauri + React.

**Free** to recover anything. **Heirvo Pro ($39 one-time)** unlocks save: MP4, ISO, individual chapters, all files, AI restoration. No subscription.

## Status

**Phase 0 — Scaffold complete.** All foundational modules in place:
- ✅ Tauri 2 + Vite + React + TypeScript shell
- ✅ Rust core library structure (`disc/`, `recovery/`, `session/`, `dvd/`, `media/`, `ai/`)
- ✅ Windows SCSI pass-through sector reader (READ(10), READ CAPACITY, INQUIRY)
- ✅ Multi-pass recovery engine (Triage → SlowRead → Reverse → ThermalPause)
- ✅ Packed sector map with zstd persistence (~573KB per DVD)
- ✅ SQLite session store with sqlx migrations
- ✅ Resume support — sector map restored on session load
- ✅ Tauri IPC commands wired end-to-end with typed TS bindings
- ✅ React UI: 5-step Recovery Wizard, live Dashboard, sector map heatmap

**Stubbed (next phases):**
- DVD IFO/BUP parser (Phase 1)
- ISO assembly + FFmpeg transcoding (Phase 2)
- AI enhancement: Real-ESRGAN, RIFE, DeepFilterNet (Phase 4)

## Prerequisites

- **Node.js** 20+
- **Rust** 1.75+ (`rustup install stable`)
- **Visual Studio Build Tools** (for the MSVC toolchain on Windows)
- **WebView2** runtime (preinstalled on Windows 11)

## Setup

```bash
npm install
```

This pulls down JS deps and `npm run tauri dev` will trigger Cargo on first run.

## Run in development

```bash
npm run tauri dev
```

The app launches with Rust backend + Vite HMR frontend. Logs print to the terminal.

## Build a release installer

```bash
npm run tauri build
```

Produces an NSIS `.exe` installer and an MSI under `src-tauri/target/release/bundle/`.

### AI features (optional `onnx` Cargo feature)

By default the app uses `MockAiBackend` for AI dispatch — proves the
end-to-end pipeline works but doesn't actually upscale frames. To enable real
Real-ESRGAN inference via ONNX Runtime + DirectML:

```bash
npm run tauri build -- --features onnx
```

Or for dev:

```bash
cargo run --features onnx
```

This pulls in `ort` (~50MB of native libraries) and routes the active backend
through DirectML (NVIDIA / AMD / Intel GPUs on Windows). The `MockAiBackend`
remains as a runtime fallback if the ONNX runtime DLL fails to load.

You'll also need to install actual ONNX model files. The app shows a
**Download** button in the Enhancement screen for any model that has a
configured URL. Models without a configured URL can be installed manually:
drop the `.onnx` file at `%APPDATA%\com.heirvo.app\models\<model_id>.onnx`
and the catalog will detect it automatically.

## Project layout

```
dvd-recovery/
├── src/                      React frontend (TypeScript)
│   ├── app/                  Top-level App + routing
│   ├── screens/              Wizard, Dashboard, History, Enhancement
│   └── lib/                  Typed IPC bindings, types, utilities
├── src-tauri/                Rust backend
│   ├── src/
│   │   ├── disc/             SCSI I/O, drive enumeration, sector reader
│   │   ├── recovery/         Sector map, multi-pass engine
│   │   ├── session/          SQLite persistence, resume logic
│   │   ├── dvd/              IFO/BUP parsing (stub)
│   │   ├── media/            FFmpeg pipeline (stub)
│   │   ├── ai/               Enhancement pipeline (stub)
│   │   ├── commands/         Tauri IPC handlers
│   │   ├── error.rs          App-wide error type
│   │   ├── state.rs          Global state managed by Tauri
│   │   └── lib.rs            Tauri builder + handler registration
│   ├── migrations/           SQLite migration files
│   └── Cargo.toml
└── package.json
```

## Architecture overview

See the in-repo design doc — the recovery engine is modeled on GNU ddrescue's
multi-pass strategy but adapted for DVD geometry. Sector reading goes through
the Windows SCSI pass-through IOCTL; the engine is decoupled via the
`SectorReader` trait so future Mac/Linux backends and test mocks slot in cleanly.

## License

TBD — must be GPL-compatible due to libdvdread linkage.
