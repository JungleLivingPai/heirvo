// TypeScript mirrors of Rust IPC types.

export interface DriveCapabilities {
  reads_dvd: boolean;
  reads_cd: boolean;
  reads_bluray: boolean;
  supports_speed_control: boolean;
}

export interface DriveInfo {
  path: string;
  letter: string;
  vendor: string;
  model: string;
  firmware: string;
  capabilities: DriveCapabilities;
  has_media: boolean;
}

export type DiscType =
  | "DvdVideo"
  | "DvdRom"
  | "DvdAudio"
  | "Cd"
  | "AudioCd"
  | "Bluray"
  | "Unknown";

export interface AudioTrack {
  number: number;
  start_lba: number;
  end_lba: number;
  duration_secs: number;
}

export interface AudioToc {
  tracks: AudioTrack[];
  lead_out_lba: number;
}

export interface ExtractedAudioFile {
  track_number: number;
  file_path: string;
  size_bytes: number;
  duration_secs: number;
  bad_sectors: number;
}

export interface DiscInfo {
  disc_type: DiscType;
  label: string;
  total_sectors: number;
  sector_size: number;
  fingerprint: string;
  has_video_ts: boolean;
  has_audio_ts: boolean;
}

export type SessionStatus =
  | "created"
  | "scanning"
  | "recovering"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Recovery pacing mode.
 * - "standard": balanced — block triage first, fast on healthy drives.
 * - "patient": kind to weak / bus-powered drives. Sector-by-sector reads with
 *   ~2s rest between each, designed to run for hours without disconnects.
 */
export type RecoveryMode = "standard" | "patient";

/** Freemium license status. Returned by get_license_status IPC. */
export type Plan = "free" | "pro";
export interface LicenseStatus {
  plan: Plan;
  holder: string | null;
  can_save: boolean;
}

/** A local storage destination (for picking output drives). NOT optical drives. */
export interface StorageDrive {
  path: string;        // "D:\\" with trailing backslash on Windows
  label: string;       // Volume label, may be empty
  kind: "fixed" | "removable" | "network";
  total_bytes: number;
  free_bytes: number;
}

export interface Session {
  id: string;
  disc_label: string;
  disc_fingerprint: string;
  drive_path: string;
  total_sectors: number;
  output_dir: string;
  status: SessionStatus;
  current_pass: number;
  created_at: number;
  updated_at: number;
  disc_type: DiscType | null;
  user_label: string | null;
}

export type DriveHealthHint = "unknown" | "good" | "marginal" | "suspect";

export interface RecoveryStats {
  good: number;
  failed: number;
  skipped: number;
  unknown: number;
  total: number;
  current_lba: number;
  current_pass: number;
  pass_strategy: string;
  speed_sps: number;
  elapsed_secs: number;
  eta_secs: number | null;
  /** Heuristic about whether the drive itself looks healthy. */
  drive_health: DriveHealthHint;
  /** Cumulative successful sector reads since recovery started. */
  reads_ok: number;
  /** Cumulative failed read attempts since recovery started. */
  reads_err: number;
  /** Seconds since the last successful read; null if we never had one. */
  idle_secs: number | null;
}

export interface RecoveryProgress {
  session_id: string;
  stats: RecoveryStats;
}

export interface IsoEntry {
  name: string;
  is_dir: boolean;
  start_lba: number;
  size_bytes: number;
}

export interface StructureSummary {
  volume_label: string;
  video_ts_files: IsoEntry[];
}

export interface ExtractedFile {
  name: string;
  path: string;
  size_bytes: number;
  good_sectors: number;
  zero_filled_sectors: number;
}

export interface HealthReport {
  score: number;
  coverage_pct: number;
  critical_intact: boolean;
  failed_sectors: number;
  largest_failed_run: number;
  summary: string;
}

export interface IsoResult {
  path: string;
  bytes_written: number;
  good_sectors: number;
  zero_filled_sectors: number;
}

export type OutputCodec = "h264" | "h265" | "av1";
export type QualityPreset = "archive" | "high_quality" | "streaming" | "mobile";

export interface TranscodeJob {
  input: string;
  output: string;
  codec: OutputCodec;
  quality: QualityPreset;
  deinterlace: boolean;
  denoise: boolean;
  resolution: [number, number] | null;
}

export interface TranscodeStarted {
  job_id: string;
}

export interface FfmpegStatus {
  available: boolean;
  path: string | null;
  version: string | null;
}

export type InstallStage = "starting" | "downloading" | "extracting" | "installed" | "failed";

export interface InstallProgress {
  stage: InstallStage;
  bytes_done: number;
  bytes_total: number;
  message: string;
}

export interface ProbeResult {
  duration_secs: number;
  video_codec: string;
  audio_codec: string;
  width: number;
  height: number;
  interlaced: boolean;
}

export interface TranscodeProgress {
  job_id: string;
  frame: number;
  fps: number;
  bitrate_kbps: number;
  out_time_us: number;
  speed: number;
  progress: string;
}

export type AiModel =
  | "RealEsrganX2"
  | "RealEsrganX4"
  | "Rife4"
  | "DeepFilterNet"
  | "BasicVsr";

export type EnhancementOp =
  | { kind: "deinterlace" }
  | { kind: "denoise" }
  | { kind: "upscale"; model: AiModel }
  | { kind: "interpolate_frames"; model: AiModel; target_fps: number }
  | { kind: "audio_cleanup"; model: AiModel };

export interface EnhancementJob {
  input: string;
  output: string;
  ops: EnhancementOp[];
}

export type AiPreset = "light" | "standard" | "maximum";

export interface AiBackendInfo {
  name: string;
  device: string;
  tile_layout: "bgra" | "rgb";
  max_tile_size: number;
  available?: boolean;
}

export type AiJobStatus = "queued" | "running" | "complete" | "error";

export interface AiJobRecord {
  id: number;
  session_id: string | null;
  input_file: string;
  output_file: string;
  status: AiJobStatus;
  progress: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
}

export interface AiJobProgress {
  job_id: number;
  progress: number;
}

export interface AiJobError {
  job_id: number;
  error: string;
}

export interface ModelEntry {
  model: AiModel;
  installed: boolean;
  path: string | null;
  size_mb: number;
  download_url: string | null;
  has_pinned_hash: boolean;
  description: string;
}

export interface ModelCatalog {
  models: ModelEntry[];
}

export type ModelDownloadStage =
  | "starting"
  | "downloading"
  | "verifying"
  | "installed"
  | "failed";

export interface ModelDownloadProgress {
  model_id: string;
  stage: ModelDownloadStage;
  bytes_done: number;
  bytes_total: number;
  message: string;
}

export interface ModelDownloadResult {
  model_id: string;
  path: string;
  bytes: number;
  verified: boolean;
}

export interface PreviewResult {
  original_png_path: string;
  enhanced_png_path: string;
  original_width: number;
  original_height: number;
  enhanced_width: number;
  enhanced_height: number;
  backend_name: string;
  upscale_factor: number;
}

export function presetOps(preset: AiPreset): EnhancementOp[] {
  // Mirrors src-tauri/src/ai/pipeline.rs Preset::ops()
  switch (preset) {
    case "light":
      return [
        { kind: "deinterlace" },
        { kind: "denoise" },
        { kind: "upscale", model: "RealEsrganX2" },
      ];
    case "standard":
      return [
        { kind: "deinterlace" },
        { kind: "denoise" },
        { kind: "upscale", model: "RealEsrganX2" },
        { kind: "audio_cleanup", model: "DeepFilterNet" },
      ];
    case "maximum":
      return [
        { kind: "deinterlace" },
        { kind: "denoise" },
        { kind: "upscale", model: "RealEsrganX2" },
        { kind: "interpolate_frames", model: "Rife4", target_fps: 60 },
        { kind: "audio_cleanup", model: "DeepFilterNet" },
      ];
  }
}

// SectorState values returned by the downsampled map (1 byte per bucket).
export const SECTOR_STATE = {
  Unknown: 0b00,
  Good: 0b01,
  Failed: 0b10,
  Skipped: 0b11,
} as const;

// Preflight checks shown on first launch.
export interface PreflightCheck {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
  critical: boolean;
}

export interface PreflightStatus {
  seen: boolean;
  checks: PreflightCheck[];
  allCriticalOk: boolean;
}
