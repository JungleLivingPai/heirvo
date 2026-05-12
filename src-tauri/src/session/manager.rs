//! Session CRUD and resume logic.

use crate::error::{AppError, AppResult};
use crate::recovery::map::SectorMap;
use crate::session::db::Db;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Created,
    Scanning,
    Recovering,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl SessionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SessionStatus::Created => "created",
            SessionStatus::Scanning => "scanning",
            SessionStatus::Recovering => "recovering",
            SessionStatus::Paused => "paused",
            SessionStatus::Completed => "completed",
            SessionStatus::Failed => "failed",
            SessionStatus::Cancelled => "cancelled",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "scanning" => SessionStatus::Scanning,
            "recovering" => SessionStatus::Recovering,
            "paused" => SessionStatus::Paused,
            "completed" => SessionStatus::Completed,
            "failed" => SessionStatus::Failed,
            "cancelled" => SessionStatus::Cancelled,
            _ => SessionStatus::Created,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub disc_label: String,
    pub disc_fingerprint: String,
    pub drive_path: String,
    pub total_sectors: u64,
    pub output_dir: String,
    pub status: SessionStatus,
    pub current_pass: u8,
    pub created_at: i64,
    pub updated_at: i64,
    /// Disc type as a stringified `DiscType` variant (e.g. "DvdVideo",
    /// "Cd", "DvdRom", "DvdAudio", "Bluray", "Unknown"). NULL for sessions
    /// created before this column existed — treat NULL as "Unknown" and
    /// fall back to showing all Save buttons.
    pub disc_type: Option<String>,
    /// User-supplied friendly name (e.g. "Mom's Wedding 1998"). Overrides
    /// disc_label in the UI when present. NULL for older sessions.
    pub user_label: Option<String>,
}

pub fn fingerprint_disc(volume_descriptor_sector: &[u8], total_sectors: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(volume_descriptor_sector);
    hasher.update(total_sectors.to_le_bytes());
    format!("{:x}", hasher.finalize())
}

pub async fn create(
    db: &Db,
    disc_label: &str,
    disc_fingerprint: &str,
    drive_path: &str,
    total_sectors: u64,
    output_dir: &str,
    disc_type: Option<&str>,
) -> AppResult<Session> {
    let id = Uuid::new_v4();
    let now = Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO recovery_sessions
         (id, disc_label, disc_fingerprint, drive_path, total_sectors, output_dir, status, current_pass, created_at, updated_at, disc_type)
         VALUES (?, ?, ?, ?, ?, ?, 'created', 0, ?, ?, ?)",
    )
    .bind(id.to_string())
    .bind(disc_label)
    .bind(disc_fingerprint)
    .bind(drive_path)
    .bind(total_sectors as i64)
    .bind(output_dir)
    .bind(now)
    .bind(now)
    .bind(disc_type)
    .execute(&db.pool)
    .await?;

    Ok(Session {
        id,
        disc_label: disc_label.into(),
        disc_fingerprint: disc_fingerprint.into(),
        drive_path: drive_path.into(),
        total_sectors,
        output_dir: output_dir.into(),
        status: SessionStatus::Created,
        current_pass: 0,
        created_at: now,
        updated_at: now,
        disc_type: disc_type.map(str::to_owned),
        user_label: None,
    })
}

/// Update the disc type for a session. Useful if the disc was reclassified
/// after a deeper scan (e.g. an ambiguous DVD-ROM turned out to be DVD-Video).
pub async fn update_disc_type(db: &Db, id: Uuid, disc_type: Option<&str>) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE recovery_sessions SET disc_type = ?, updated_at = ? WHERE id = ?")
        .bind(disc_type)
        .bind(now)
        .bind(id.to_string())
        .execute(&db.pool)
        .await?;
    Ok(())
}

/// Set or clear the user-supplied label for a session.
/// Passing `None` or an empty string clears the label.
pub async fn rename(db: &Db, id: Uuid, label: Option<&str>) -> AppResult<()> {
    let label = label.and_then(|s| if s.trim().is_empty() { None } else { Some(s.trim()) });
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE recovery_sessions SET user_label = ?, updated_at = ? WHERE id = ?")
        .bind(label)
        .bind(now)
        .bind(id.to_string())
        .execute(&db.pool)
        .await?;
    Ok(())
}

pub async fn list_all(db: &Db) -> AppResult<Vec<Session>> {
    let rows = sqlx::query("SELECT * FROM recovery_sessions ORDER BY updated_at DESC")
        .fetch_all(&db.pool)
        .await?;
    rows.into_iter().map(row_to_session).collect()
}

pub async fn get(db: &Db, id: Uuid) -> AppResult<Session> {
    let row = sqlx::query("SELECT * FROM recovery_sessions WHERE id = ?")
        .bind(id.to_string())
        .fetch_optional(&db.pool)
        .await?
        .ok_or_else(|| AppError::SessionNotFound(id.to_string()))?;
    row_to_session(row)
}

pub async fn delete(db: &Db, id: Uuid) -> AppResult<()> {
    sqlx::query("DELETE FROM recovery_sessions WHERE id = ?")
        .bind(id.to_string())
        .execute(&db.pool)
        .await?;
    Ok(())
}

pub async fn update_status(db: &Db, id: Uuid, status: SessionStatus) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE recovery_sessions SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status.as_str())
        .bind(now)
        .bind(id.to_string())
        .execute(&db.pool)
        .await?;
    Ok(())
}

pub async fn update_drive_path(db: &Db, id: Uuid, drive_path: &str) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE recovery_sessions SET drive_path = ?, updated_at = ? WHERE id = ?")
        .bind(drive_path)
        .bind(now)
        .bind(id.to_string())
        .execute(&db.pool)
        .await?;
    Ok(())
}

/// Change the output directory for an existing session. Used when the user
/// wants to save the recovered output to a different drive (e.g. plugged in
/// a USB stick after starting recovery).
pub async fn update_output_dir(db: &Db, id: Uuid, output_dir: &str) -> AppResult<()> {
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE recovery_sessions SET output_dir = ?, updated_at = ? WHERE id = ?")
        .bind(output_dir)
        .bind(now)
        .bind(id.to_string())
        .execute(&db.pool)
        .await?;
    Ok(())
}

pub async fn save_sector_map(db: &Db, id: Uuid, map: &SectorMap) -> AppResult<()> {
    let compressed = map.to_compressed()?;
    let now = Utc::now().timestamp();
    let mut hasher = Sha256::new();
    hasher.update(&compressed);
    let checksum = format!("{:x}", hasher.finalize());

    sqlx::query(
        "INSERT INTO sector_maps (session_id, total, data, checksum, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
            total = excluded.total,
            data = excluded.data,
            checksum = excluded.checksum,
            updated_at = excluded.updated_at",
    )
    .bind(id.to_string())
    .bind(map.total() as i64)
    .bind(compressed)
    .bind(checksum)
    .bind(now)
    .execute(&db.pool)
    .await?;
    Ok(())
}

pub async fn load_sector_map(db: &Db, id: Uuid) -> AppResult<Option<SectorMap>> {
    let row = sqlx::query("SELECT total, data FROM sector_maps WHERE session_id = ?")
        .bind(id.to_string())
        .fetch_optional(&db.pool)
        .await?;
    let Some(row) = row else { return Ok(None) };
    let total: i64 = row.try_get("total")?;
    let data: Vec<u8> = row.try_get("data")?;
    Ok(Some(SectorMap::from_compressed(total as u64, &data)?))
}

fn row_to_session(row: sqlx::sqlite::SqliteRow) -> AppResult<Session> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str)
        .map_err(|e| AppError::Internal(format!("bad session uuid: {e}")))?;
    let total: i64 = row.try_get("total_sectors")?;
    let pass: i64 = row.try_get("current_pass")?;
    let status_s: String = row.try_get("status")?;
    Ok(Session {
        id,
        disc_label: row.try_get("disc_label")?,
        disc_fingerprint: row.try_get("disc_fingerprint")?,
        drive_path: row.try_get("drive_path")?,
        total_sectors: total as u64,
        output_dir: row.try_get("output_dir")?,
        status: SessionStatus::parse(&status_s),
        current_pass: pass as u8,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        // Flatten nested Option: try_get returns Result<Option<String>>; .ok()
        // makes it Option<Option<String>>; flatten collapses NULLs to None.
        disc_type: row.try_get::<Option<String>, _>("disc_type").ok().flatten(),
        user_label: row.try_get::<Option<String>, _>("user_label").ok().flatten(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn temp_db() -> Db {
        let mut path = std::env::temp_dir();
        path.push(format!("heirvo-test-{}.db", Uuid::new_v4()));
        let db = Db::open(&path).await.unwrap();
        db.migrate().await.unwrap();
        db
    }

    #[tokio::test]
    async fn migration_applies_and_disc_type_roundtrips() {
        let db = temp_db().await;

        // Insert without disc_type — old-style session.
        let s1 = create(&db, "old disc", "fp1", "\\\\.\\D:", 100, "/tmp/out1", None)
            .await
            .unwrap();
        assert!(s1.disc_type.is_none());
        let got1 = get(&db, s1.id).await.unwrap();
        assert!(got1.disc_type.is_none());

        // Insert with disc_type.
        let s2 = create(
            &db,
            "movie",
            "fp2",
            "\\\\.\\E:",
            200,
            "/tmp/out2",
            Some("DvdVideo"),
        )
        .await
        .unwrap();
        assert_eq!(s2.disc_type.as_deref(), Some("DvdVideo"));
        let got2 = get(&db, s2.id).await.unwrap();
        assert_eq!(got2.disc_type.as_deref(), Some("DvdVideo"));

        // Update.
        update_disc_type(&db, s1.id, Some("Cd")).await.unwrap();
        let got1b = get(&db, s1.id).await.unwrap();
        assert_eq!(got1b.disc_type.as_deref(), Some("Cd"));
    }
}
