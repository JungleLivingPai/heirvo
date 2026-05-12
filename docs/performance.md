# Performance Targets

Targets that must be met or release blocks.

| Operation | Target | Hard limit |
|---|---|---|
| App cold start | <2s | <4s |
| Disc detection after insert | <3s | <5s |
| Stage 1 recovery (clean disc) | Realtime read speed | — |
| Cancel button response | <500ms | <1s |
| Resume from crash | <2s | <5s |
| AI restore (Light, RTX 4070) | 1.5x realtime | 0.5x realtime |
| Memory during 2-hr recovery | <500 MB | <1 GB |
| Memory during AI restore | <8 GB VRAM | <12 GB VRAM |

## GPU memory management

- Stream AI processing in chunks of N frames. Never load whole video.
- Detect VRAM, pick chunk size dynamically. Crash recovery if OOM.

## Threading model

- **Disc I/O:** dedicated thread, blocking, with timeouts.
- **FFmpeg:** subprocess (process isolation = crash safety).
- **AI:** dedicated GPU dispatch thread.
- **UI:** never blocked. All long ops via async commands.

## Resumable everywhere

- Recovery: per-sector map.
- AI restore: chunk index in job state.
- Encode: ffmpeg supports `-ss` resume + concat.
