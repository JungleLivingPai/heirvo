# AI Video Restoration

**Philosophy: preserve, don't transform.**

This is where Topaz pisses people off. Their default models over-sharpen and make everything look "waxy" or "AI-plastic." User reviews repeatedly call out the *waxy skin effect*. **Win by being conservative.**

## Core principle

A grandma watching restored 2002 footage of her late husband should think *"the picture is clearer"* — not *"this looks like a video game."* The original character must survive.

## Pipeline order (do not deviate)

1. Decode + deinterlace (`bwdif` → 60p)
2. **Light** denoise (temporal, very gentle — `hqdn3d=1.5:1.5:6:6` as starting point — preserves grain character)
3. AI upscale (Real-ESRGAN at **2x — never 4x for home video**, you're inventing detail that wasn't there)
4. Optional face enhancement (GFPGAN or CodeFormer — but **off by default**, with clear "may alter how faces look" warning)
5. Color/levels normalization (gentle — fix faded colors, don't reinvent them)
6. Encode (H.264, CRF 18, slow preset)

## Three preset levels — no expert sliders

| Preset | Pipeline | Speed (RTX 4070) |
|---|---|---|
| **Light** *(default)* | Deinterlace + denoise + 2x upscale. Safest. | ~3-4x slower than realtime |
| **Standard** | + color correction + audio normalize | |
| **Maximum** | + face enhancement + frame interpolation to 60fps | Big "experimental" warning |

## Always

- Keep the original recovered file. **Never delete it.** Restoration is a new file.
- Show **side-by-side preview** before committing to full processing.
- **Sample on a 30-second clip first**; let user approve before processing 2 hours.

## Never

- Generate frames from nothing (no Starlight-style diffusion-from-zero — too risky for irreplaceable footage).
- Apply heavy sharpening as default.
- Auto-colorize black-and-white. (Optional, opt-in only, with prominent warning.)

## Models (all open, no licensing fees)

- **Real-ESRGAN** (anime + general models) — upscaling
- **BasicVSR++** — temporal upscaling for video specifically
- **GFPGAN** — face restoration (opt-in only)
- **RIFE** — frame interpolation

All ONNX exports, run via **DirectML** for cross-vendor GPU support (NVIDIA, AMD, Intel — beats Topaz which is NVIDIA-favored).
