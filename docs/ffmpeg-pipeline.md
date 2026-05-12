# FFmpeg Pipeline

FFmpeg is core infrastructure. **Bundle it**, don't ask user to install.

## Bundling

- Ship `ffmpeg.exe` and `ffprobe.exe` inside the app's resource folder. ~80MB. Fine.
- Statically linked, GPL build (we link via subprocess so GPL is fine).
- Pin a specific version. Test against it. Never use system ffmpeg.

## The two-stage output (critical UX win)

### Stage 1 — Stream copy (instant, lossless)

```bash
ffmpeg -err_detect ignore_err \
       -i concat:VTS_01_1.VOB|VTS_01_2.VOB|VTS_01_3.VOB \
       -c copy -map 0:v -map 0:a output.mp4
```

- No re-encoding. Takes seconds. Lossless.
- User has a playable file before they finish making coffee.
- **Default output for everyone.**

### Stage 2 — AI restoration (optional, slow, opt-in)

- Only run if user clicks "Enhance video".
- **Always preserves the original Stage 1 output. Never overwrites.**

## Deinterlacing (mandatory for home video DVDs)

- All home-video DVDs are interlaced. Stage 1 keeps this; Stage 2 must deinterlace.
- Use **`bwdif`** filter (better than yadif for old footage). Output 60p from 60i, not 30p — preserves motion.

## Hardware acceleration

- Decode: `-hwaccel d3d11va` (Windows native, works on all GPUs).
- Encode for transcoded outputs: `h264_nvenc` / `h264_amf` / `h264_qsv` based on detected GPU.
- Always have a software fallback.

## Audio

- Always normalize loudness for the AI-enhanced output (ITU-R BS.1770, target **-16 LUFS**).
- Old camcorder audio is wildly inconsistent in level — this single thing makes "before/after" feel dramatic.

## Error tolerance flags (always on)

```
-err_detect ignore_err -fflags +discardcorrupt+genpts
```
