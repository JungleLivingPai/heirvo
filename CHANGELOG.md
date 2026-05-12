# Changelog

All notable changes to Heirvo are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-12

First public release. Recovery engine, transcode pipeline, marketing site, and mail-in service all live.

### Added
- **Recovery engine** — multi-pass sector recovery (Triage → SlowRead → Reverse → ThermalPause), modeled on GNU ddrescue.
- **Sector map** — packed bitmap with zstd persistence (~573 KB per DVD), restored on session resume.
- **SQLite session store** with sqlx migrations; sessions resume from any prior state.
- **Windows SCSI pass-through** sector reader (READ(10), READ CAPACITY, INQUIRY) — page-aligned buffers, MAX_BLOCK_SECTORS=32.
- **Transcode pipeline** — FFmpeg subprocess with H.264/H.265/AV1 codecs and quality presets (Archive / High / Streaming / Mobile). Deinterlace (bwdif) + denoise (hqdn3d) toggles.
- **AI enhancement pipeline** — `MockAiBackend` end-to-end; real Real-ESRGAN backend behind optional `onnx` Cargo feature (DirectML).
- **Tauri 2 IPC** — typed TypeScript bindings for all backend commands.
- **React UI** — 5-step Recovery Wizard, live Dashboard, sector heatmap, Transcode panel, Enhancement panel.
- **Bundled FFmpeg** (`ffmpeg.exe` + `ffprobe.exe`, ~193 MB raw, LGPL essentials build) — no first-run download required.
- **Branded NSIS installer** — kintsugi disc icon, branded sidebar/header, silent install support.
- **Marketing site** at heirvo.com — landing page, mail-in order form (Formspree → Stripe intake fee), Pro checkout via Lemon Squeezy.
- **Legal pages** — Privacy, Terms, Refund, Acceptable Use.

### Fixed
- **FFmpeg auto-download fallback** — switched primary URL to gyan.dev (stable filename); secondary fallback now resolves real GitHub asset name via Releases API and triggers on HTTP 4xx/5xx (not just transport errors).
- **Transcode form styling** — inputs and dropdowns no longer render unreadable dark-on-dark on the light theme.
- **iOS Safari marketing site freeze** — `sessionStorage` calls wrapped in try/catch (Private Mode throws `SecurityError`); `LoadSequence` overlay has 3s safety timeout to release `body.overflow` on stalled clip-path animations.
- **Marketing build** — replaced `useRef<HTMLBlockquoteElement>` with `useRef<HTMLQuoteElement>` (TypeScript build error blocking Vercel deploys).
- **Bundle resources** — explicit file paths for `ffmpeg.exe` + `ffprobe.exe` in `tauri.conf.json` (the `resources/ffmpeg/*` glob wasn't picking up `.exe` files in NSIS bundles).

### Project hygiene
- Migrated repo from `C:\projects\DVD-Recovery\` to `C:\projects\Heirvo\` — single consolidated home for desktop app + marketing site.
- Removed 22 deprecated landing/recover variant pages from marketing site.
- Removed 21 orphaned image files (42 MB) from `assets/` and `marketing/public/assets/` after grep verification of every reference.
- Lazy-loaded all non-canonical marketing routes — main JS bundle reduced from ~1 MB to 433 KB gzipped.
- Renamed app identifier `com.dvdrecovery.app` → `com.heirvo.app`.

### Known limitations
- Not yet code-signed — Windows SmartScreen will warn on install. Workaround: click **More info → Run anyway**.
- DVD-Video CSS-encrypted commercial discs are intentionally unsupported (not a DRM-circumvention tool).
- Mail-in service requires manual address routing per customer pending physical drop-point setup.
