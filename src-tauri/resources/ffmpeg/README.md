# Bundled FFmpeg

> NOTE: Bundle config in `tauri.conf.json` is currently disabled because Tauri's
> resource glob refuses to build when the path matches no files. Re-enable
> `"resources": ["resources/ffmpeg/*"]` in `bundle` once `ffmpeg.exe` and
> `ffprobe.exe` are present in this directory.



Place `ffmpeg.exe` and `ffprobe.exe` here for them to be included in release builds.

## Why

The app's transcode pipeline shells out to FFmpeg. We deliberately bundle the
binary rather than link to it — keeps the LGPL boundary clean and lets us pin
a known-good version.

## Where to get it (Windows x64)

Use the gyan.dev "essentials" build:

- https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

Download, extract, copy `bin/ffmpeg.exe` and `bin/ffprobe.exe` to this directory.

## Runtime fallback

If the binary isn't bundled (e.g. dev builds), the app's "Download FFmpeg" button
fetches the same build at first use into `%APPDATA%\com.dvdrecovery.app\ffmpeg\`.
See `src/media/ffmpeg.rs::locate()` for the lookup order.

## Don't commit the binary

The `.exe` files are excluded by `.gitignore` (~80MB). Each developer / CI run
should fetch them locally. A future `scripts/fetch-ffmpeg.ps1` will automate this.
