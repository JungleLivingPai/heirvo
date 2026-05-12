# Release Prep — Code Signing & Benchmark Plan

Two release-critical items that can't be fully automated from this codebase
but have concrete, scoped next steps.

## 1. Code signing

**Why mandatory:** Per `docs/windows-native.md`, unsigned recovery software
triggers Windows SmartScreen on first install — kills user trust before
they've even opened the app. Code-signing is **release-blocking, not optional**.

### Certificate options (priced as of late 2025)

| Type | Cost / yr | Notes |
|---|---|---|
| **EV (Extended Validation)** | ~$300–500 | Best UX. SmartScreen reputation starts immediately, no warning. Requires hardware token (USB key) for signing. |
| **OV (Organization Validation)** | ~$200–400 | Cheaper. SmartScreen warning appears until enough installs build reputation (typically a few weeks). |
| **Self-signed** | $0 | Useless for distribution — every user sees a "Windows protected your PC" wall. Only fine for internal testing. |

Recommend **EV** for v1 release. Vendors that don't require dedicated hardware
in 2025: SSL.com, Sectigo (via reseller), Comodo CA. Hardware-token vendors
(DigiCert, GlobalSign) are mainstream but slower.

### Build-time integration

Tauri 2 wires this through `tauri.conf.json` `bundle.windows.signCommand`.
After receiving the cert:

```jsonc
// In tauri.conf.json bundle.windows:
"signCommand": "signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /sha1 <THUMBPRINT> %1"
```

`<THUMBPRINT>` is the cert's SHA-1 thumbprint after import to Windows cert
store. The `%1` is filled by Tauri with each artifact path (the .exe and the
NSIS/MSI installers).

For CI/CD, use an environment variable for the thumbprint and `signtool` from
the Windows SDK (typically at
`C:\Program Files (x86)\Windows Kits\10\bin\<ver>\x64\signtool.exe`).

### Verification

After build, verify signature on the installer:

```powershell
Get-AuthenticodeSignature .\src-tauri\target\release\bundle\nsis\dvd-recovery_0.1.0_x64-setup.exe
```

Should show `Status: Valid` and a `SignerCertificate` matching the issued cert.

## 2. Real-disc benchmark vs IsoBuster / CDRoller

**Why this matters:** Per `docs/monetization.md`, this is the marketing wedge.
Without measurable proof we recover at least as well as the established
commercial tools, there's no story for paid customers.

### What you need

- 20–30 actually-damaged DVDs from thrift stores or eBay lots (~$30 total).
  Mix of:
  - Pressed (commercial) discs with surface scratches
  - DVD-R / DVD+R home recordings (often unfinalized — important for our
    target audience)
  - Discs with rot or laser-side damage
  - At least one disc with a deep scratch through the data layer
- Trial or licensed copies of IsoBuster ($69) and CDRoller ($39).
- A spreadsheet for tracking results.

### Procedure

For each disc:

1. Run our app's full recovery — record:
   - Time to first playable output (Stage 1 stream-copy)
   - Time to fully-recovered ISO
   - Final health score
   - Number of successfully-recovered sectors
   - Number of zero-filled (damaged) sectors
2. Run IsoBuster on the same disc — record:
   - Whether IsoBuster's "find missing files" finds anything we missed
   - Final extraction percentage
3. Run CDRoller — same metrics, plus does its unfinalized-disc handling
   beat ours?
4. Visually compare an extracted clip from each tool — any obvious
   corruption differences?

### Expected output

- A `docs/benchmark-results.md` with the table of 20+ discs × 3 tools × 4
  metrics each.
- A short YouTube video walkthrough on 3–5 representative discs (per
  `docs/monetization.md`'s SEO/YouTube wedge).

### What "good" looks like

- We tie or beat IsoBuster on **average** sector recovery percentage.
- We **always** produce a playable Stage 1 MP4, even when the others abort.
- Our failed discs are also failed by all three tools (i.e. the disc is
  genuinely unreadable, not a bug).

## Other pre-release items (already in the codebase, but worth re-verifying)

- [ ] Replace the placeholder app icons (`src-tauri/icons/`) with real artwork
- [ ] Pin model URLs + SHA-256 hashes in `src/ai/models.rs::download_url()` /
      `expected_sha256()` once we host mirrors
- [ ] Run `npm run fetch-ffmpeg` before final release build
- [ ] Set `tauri.conf.json` `productName` from "DVD Recovery" to final brand
      name
- [ ] Buy `dvdrescue.com` (or chosen domain) — already referenced as the
      identifier in the app
