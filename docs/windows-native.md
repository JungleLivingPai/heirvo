# Windows Native Integration

Use real Windows APIs. No web-app hacks for hardware.

## Drive enumeration

- `SetupDiGetClassDevs` + `GUID_DEVINTERFACE_CDROM` — get all optical drives.
- Display friendly: **"ASUS DRW-24B1ST"** not `\\.\CdRom0`.

## Raw sector access

- `CreateFile(\\.\CdRom0, GENERIC_READ, FILE_SHARE_READ|FILE_SHARE_WRITE, ...)` for raw access.
- `IOCTL_CDROM_RAW_READ` for sector-level reads with bad sector tolerance.
- `IOCTL_STORAGE_CHECK_VERIFY` to detect disc-in-drive without spinning up.
- Use **overlapped I/O** so cancellation actually works.

## USB device hot-plug

- Listen for `WM_DEVICECHANGE`. Update available drives live.
- Show toast when disc is inserted or removed.

## Permissions

- Raw device access requires the user to be in Administrators OR the app to be elevated.
- **Solution:** ship a small elevated helper service that does only the raw I/O, plain app talks to it via named pipe. UAC prompt **once at install, never again.**

## Crash handling

- Wrap every job in a watchdog process. If the worker dies, parent restarts and resumes from the recovery map.
- Crash dumps written to `%LOCALAPPDATA%\DVDRescue\crashes\` with anonymized symbols.
- Single "Send crash report" button — opt-in, no auto-telemetry.

## File system

- Outputs default to `Documents\DVD Rescue\<disc-title>\` — predictable, indexable.
- Recovery maps in `%LOCALAPPDATA%\DVDRescue\jobs\<job-id>\` — survives reinstall.

## Code signing

Mandatory. Unsigned recovery software triggers SmartScreen and kills trust on first install. EV certificate if budget allows; standard OV at minimum. ~$200-400/year.
