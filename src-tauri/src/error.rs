//! Application-wide error type. All Tauri commands return `Result<T, AppError>`.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Database migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Drive error: {0}")]
    Drive(String),

    #[error("Sector read error at LBA {lba}: {message}")]
    SectorRead { lba: u64, message: String },

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Recovery already in progress for session {0}")]
    RecoveryInProgress(String),

    #[error("DVD structure error: {0}")]
    DvdStructure(String),

    #[error("Media pipeline error: {0}")]
    Media(String),

    #[error("AI pipeline error: {0}")]
    Ai(String),

    #[error("Not implemented: {0}")]
    NotImplemented(&'static str),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
