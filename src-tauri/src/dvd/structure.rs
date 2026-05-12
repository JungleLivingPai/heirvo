//! DVD structure model — titles, chapters, audio/subtitle streams.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DvdStructure {
    pub volume_label: String,
    pub titles: Vec<Title>,
    pub has_css_protection: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Title {
    pub index: u8,
    pub duration_secs: u32,
    pub start_sector: u64,
    pub end_sector: u64,
    pub chapters: Vec<Chapter>,
    pub audio_tracks: Vec<AudioTrack>,
    pub subtitle_tracks: Vec<SubtitleTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub index: u8,
    pub start_offset_secs: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrack {
    pub index: u8,
    pub language: String,
    pub codec: String,
    pub channels: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleTrack {
    pub index: u8,
    pub language: String,
}
