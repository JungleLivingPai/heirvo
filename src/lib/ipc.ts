import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DriveInfo,
  DiscInfo,
  DiscType,
  Session,
  RecoveryProgress,
  StructureSummary,
  ExtractedFile,
  HealthReport,
  IsoResult,
  TranscodeJob,
  TranscodeStarted,
  TranscodeProgress,
  FfmpegStatus,
  ProbeResult,
  RecoveryMode,
  StorageDrive,
  LicenseStatus,
  AudioToc,
  ExtractedAudioFile,
} from "./types";

export const ipc = {
  // Drives
  listDrives: () => invoke<DriveInfo[]>("list_drives"),
  checkDisc: (drivePath: string) =>
    invoke<DiscInfo | null>("check_disc", { drivePath }),

  // Output destination drives (USB sticks, external HDDs — NOT optical)
  listStorageDrives: () => invoke<StorageDrive[]>("list_storage_drives"),

  // Freemium license
  getLicenseStatus: () => invoke<LicenseStatus>("get_license_status"),
  activateLicense: (key: string) => invoke<LicenseStatus>("activate_license", { key }),
  deactivateLicense: () => invoke<LicenseStatus>("deactivate_license"),

  // Sessions
  createSession: (args: {
    disc_label: string;
    disc_fingerprint: string;
    drive_path: string;
    total_sectors: number;
    output_dir: string;
    disc_type?: DiscType | null;
  }) => invoke<Session>("create_session", { args }),
  listSessions: () => invoke<Session[]>("list_sessions"),
  resumeSession: (sessionId: string) =>
    invoke<Session>("resume_session", { sessionId }),
  deleteSession: (sessionId: string) =>
    invoke<void>("delete_session", { sessionId }),
  changeDrive: (sessionId: string, newDrivePath: string) =>
    invoke<Session>("change_drive", { sessionId, newDrivePath }),
  renameSession: (sessionId: string, label: string) =>
    invoke<void>("rename_session", { sessionId, label }),
  changeOutputDir: (sessionId: string, newOutputDir: string) =>
    invoke<Session>("change_output_dir", { sessionId, newOutputDir }),

  // Recovery
  startRecovery: (sessionId: string, mode: RecoveryMode = "standard") =>
    invoke<void>("start_recovery", { sessionId, mode }),
  pauseRecovery: (sessionId: string) =>
    invoke<void>("pause_recovery", { sessionId }),
  cancelRecovery: (sessionId: string) =>
    invoke<void>("cancel_recovery", { sessionId }),
  getSectorMap: (sessionId: string, buckets: number) =>
    invoke<number[]>("get_sector_map", { sessionId, buckets }),
  exportRmap: (sessionId: string, outputPath?: string) =>
    invoke<{ path: string; bytes_written: number; run_count: number }>(
      "export_rmap",
      { sessionId, outputPath },
    ),
  importRmap: (sessionId: string, inputPath: string) =>
    invoke<{
      good_sectors: number;
      failed_sectors: number;
      skipped_sectors: number;
      unknown_sectors: number;
    }>("import_rmap", { sessionId, inputPath }),

  // DVD
  analyzeStructure: (sessionId: string) =>
    invoke<StructureSummary>("analyze_structure", { sessionId }),
  extractVobs: (sessionId: string, fileNames: string[] = []) =>
    invoke<ExtractedFile[]>("extract_vobs", { sessionId, fileNames }),
  extractAllFiles: (sessionId: string) =>
    invoke<ExtractedFile[]>("extract_all_files", { sessionId }),
  healthScore: (sessionId: string) =>
    invoke<HealthReport>("health_score", { sessionId }),

  // Media
  createIso: (sessionId: string, outputPath?: string) =>
    invoke<IsoResult>("create_iso", { sessionId, outputPath }),
  saveAsMp4: (sessionId: string) =>
    invoke<{ output_path: string; bytes_written: number; source_files: string[] }>(
      "save_as_mp4",
      { sessionId },
    ),
  ffmpegStatus: () => invoke<FfmpegStatus>("ffmpeg_status"),
  ffprobeFile: (path: string) => invoke<ProbeResult>("ffprobe_file", { path }),
  installFfmpeg: () => invoke<string>("install_ffmpeg"),
  transcode: (job: TranscodeJob) => invoke<TranscodeStarted>("transcode", { job }),

  // AI
  listModels: () => invoke<import("./types").ModelCatalog>("list_models"),
  downloadModel: (model: import("./types").AiModel) =>
    invoke<import("./types").ModelDownloadResult>("download_model", { model }),
  aiBackendInfo: () => invoke<import("./types").AiBackendInfo>("ai_backend_info"),
  queueEnhancement: (job: import("./types").EnhancementJob) =>
    invoke<number>("queue_enhancement", { job }),
  getJobStatus: (jobId: number) =>
    invoke<import("./types").AiJobRecord>("get_job_status", { jobId }),
  listEnhancementJobs: () =>
    invoke<import("./types").AiJobRecord[]>("list_enhancement_jobs"),
  enhancePreview: (input: string, timestampSecs: number, preset: import("./types").AiPreset) =>
    invoke<import("./types").PreviewResult>("enhance_preview", {
      input,
      timestampSecs,
      preset,
    }),

  // Audio CD
  readAudioToc: (sessionId: string) =>
    invoke<AudioToc>("read_audio_toc", { sessionId }),
  extractAudioTracks: (sessionId: string, outputDir?: string) =>
    invoke<ExtractedAudioFile[]>("extract_audio_tracks", { sessionId, outputDir }),

  // Shell / OS
  openFolder: (path: string) => invoke<void>("open_folder", { path }),

  // Preflight
  getPreflightStatus: () =>
    invoke<import("./types").PreflightStatus>("get_preflight_status"),
  markPreflightSeen: () => invoke<void>("mark_preflight_seen"),

  // Diagnostics
  exportDiagnosticBundle: (sessionId: string, outputPath?: string) =>
    invoke<{ zip_path: string; bytes: number; session_id: string }>(
      "export_diagnostic_bundle",
      { sessionId, outputPath },
    ),
  getLogPath: () => invoke<string>("get_log_path"),
  openLogFolder: () => invoke<void>("open_log_folder"),
};

// Typed event subscriptions
export const events = {
  onProgress(handler: (p: RecoveryProgress) => void): Promise<UnlistenFn> {
    return listen<RecoveryProgress>("recovery:progress", (e) => handler(e.payload));
  },
  onComplete(handler: (sessionId: string) => void): Promise<UnlistenFn> {
    return listen<string>("recovery:complete", (e) => handler(e.payload));
  },
  onTranscodeProgress(handler: (p: TranscodeProgress) => void): Promise<UnlistenFn> {
    return listen<TranscodeProgress>("transcode:progress", (e) => handler(e.payload));
  },
  onTranscodeComplete(handler: (jobId: string) => void): Promise<UnlistenFn> {
    return listen<string>("transcode:complete", (e) => handler(e.payload));
  },
  onTranscodeError(
    handler: (p: { job_id: string; error: string }) => void,
  ): Promise<UnlistenFn> {
    return listen<{ job_id: string; error: string }>("transcode:error", (e) => handler(e.payload));
  },
  onFfmpegInstallProgress(
    handler: (p: import("./types").InstallProgress) => void,
  ): Promise<UnlistenFn> {
    return listen<import("./types").InstallProgress>("ffmpeg:install_progress", (e) =>
      handler(e.payload),
    );
  },
  onDrivesChanged(handler: (drives: DriveInfo[]) => void): Promise<UnlistenFn> {
    return listen<DriveInfo[]>("drives:changed", (e) => handler(e.payload));
  },
  onEnhancementProgress(
    handler: (p: import("./types").AiJobProgress) => void,
  ): Promise<UnlistenFn> {
    return listen<import("./types").AiJobProgress>("enhancement:progress", (e) =>
      handler(e.payload),
    );
  },
  onEnhancementComplete(handler: (jobId: number) => void): Promise<UnlistenFn> {
    return listen<number>("enhancement:complete", (e) => handler(e.payload));
  },
  onEnhancementError(
    handler: (p: import("./types").AiJobError) => void,
  ): Promise<UnlistenFn> {
    return listen<import("./types").AiJobError>("enhancement:error", (e) =>
      handler(e.payload),
    );
  },
  onModelDownloadProgress(
    handler: (p: import("./types").ModelDownloadProgress) => void,
  ): Promise<UnlistenFn> {
    return listen<import("./types").ModelDownloadProgress>(
      "model:download_progress",
      (e) => handler(e.payload),
    );
  },
};
