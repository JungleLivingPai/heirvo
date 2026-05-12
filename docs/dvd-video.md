# DVD-Video Knowledge (just enough)

## Disc layout

- `VIDEO_TS/` directory. (Ignore `AUDIO_TS/` — empty on 99% of home video discs.)
- Files come in trios:
  - `VTS_01_0.IFO` + `VTS_01_0.BUP` (backup of IFO)
  - `VTS_01_1.VOB`, `VTS_01_2.VOB`, etc.
- `VIDEO_TS.IFO` = master menu structure (often skip for home recordings).
- `VTS_NN_M.VOB` = MPEG-2 program stream, max 1GB per file (split for FAT32 compatibility).

## Recovery priority order

1. **VOB files first.** This is the actual video. Even if everything else is corrupt, recovered VOBs are usable.
2. **IFO files second.** Tells you chapter points, audio tracks, subtitles.
3. **BUP files** = IFO backup. If IFO is dead, read BUP. **Always try both.**

## MPEG-2 program stream specifics

- Pack header sync: `0x000001BA`. Use this for resync after a bad sector.
- A corrupted GOP costs ~15 frames (~0.5 sec). Fine. Skip and continue.
- Audio is usually AC-3 (most home video DVDs) or MPEG audio. Sometimes LPCM.

## Home video specifics (your audience)

- Mostly DVD-R or DVD+R (recordable), not pressed.
- Often **unfinalized** — no proper VIDEO_TS index. CDRoller specifically advertises this for camcorder DVDs (Hitachi, Sony Handycam, Canon, Panasonic) — replicate that capability.
- Usually 4:3 or letterboxed 16:9, MPEG-2 at 4-8 Mbps, interlaced 480i/576i.
- Single audio track, no subtitles, no menus.

## Don't over-engineer

Multi-angle DVDs, complex menu systems, copy protection — none of this matters for v1. Home recordings have none of it.
