#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Downloads FFmpeg + ffprobe binaries into src-tauri/resources/ffmpeg/.

.DESCRIPTION
    Fetches the gyan.dev "essentials" Windows x64 build (LGPL, ~80MB compressed),
    extracts ffmpeg.exe and ffprobe.exe to the bundle resource directory.

    Idempotent — exits immediately if both binaries are already present.
    Safe to call as a build-time prebuild step.

.PARAMETER Force
    Re-download even if binaries already exist.

.EXAMPLE
    pwsh ./scripts/fetch-ffmpeg.ps1
    pwsh ./scripts/fetch-ffmpeg.ps1 -Force
#>

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # massively faster Invoke-WebRequest

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$TargetDir = Join-Path $RepoRoot 'src-tauri/resources/ffmpeg'
$FfmpegExe = Join-Path $TargetDir 'ffmpeg.exe'
$FfprobeExe = Join-Path $TargetDir 'ffprobe.exe'

function Format-MB {
    param([string]$Path)
    $mb = (Get-Item $Path).Length / 1MB
    return ('{0:N1} MB' -f $mb)
}

if (-not $Force -and (Test-Path $FfmpegExe) -and (Test-Path $FfprobeExe)) {
    $fmsg = 'FFmpeg already present at {0} — skipping.' -f $TargetDir
    Write-Host $fmsg -ForegroundColor Green
    Write-Host ('  ffmpeg.exe:  {0}' -f (Format-MB $FfmpegExe))
    Write-Host ('  ffprobe.exe: {0}' -f (Format-MB $FfprobeExe))
    Write-Host '  Pass -Force to re-download.'
    exit 0
}

New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$Url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
$ZipPath = Join-Path $env:TEMP "ffmpeg-release-essentials-$([System.Guid]::NewGuid().ToString('N')).zip"
$ExtractDir = Join-Path $env:TEMP "ffmpeg-extract-$([System.Guid]::NewGuid().ToString('N'))"

try {
    Write-Host "Downloading FFmpeg from gyan.dev..." -ForegroundColor Cyan
    Write-Host "  URL: $Url"
    Write-Host "  This is ~80 MB and may take a minute."
    $start = Get-Date
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing
    $elapsed = (Get-Date) - $start
    $sizeMB = (Get-Item $ZipPath).Length / 1MB
    Write-Host ("Downloaded {0:N1} MB in {1:N1}s" -f $sizeMB, $elapsed.TotalSeconds) -ForegroundColor Green

    Write-Host "Extracting..." -ForegroundColor Cyan
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

    # The zip contains ffmpeg-N.N.N-essentials_build/bin/{ffmpeg,ffprobe}.exe
    $ffmpegSrc = Get-ChildItem -Path $ExtractDir -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
    $ffprobeSrc = Get-ChildItem -Path $ExtractDir -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1

    if (-not $ffmpegSrc) { throw "ffmpeg.exe not found in archive" }
    if (-not $ffprobeSrc) { throw "ffprobe.exe not found in archive" }

    Copy-Item $ffmpegSrc.FullName $FfmpegExe -Force
    Copy-Item $ffprobeSrc.FullName $FfprobeExe -Force

    Write-Host "Installed:" -ForegroundColor Green
    Write-Host ('  {0}  ({1})' -f $FfmpegExe, (Format-MB $FfmpegExe))
    Write-Host ('  {0} ({1})' -f $FfprobeExe, (Format-MB $FfprobeExe))
} finally {
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue }
    if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue }
}
