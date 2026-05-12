//! License management for the freemium tier.
//!
//! v1 model:
//! - **Free** — full recovery (sector reads, sector map, disc health, preview).
//! - **Pro** — unlocks Save (MP4, ISO, chapter extract, all-files).
//!
//! Validation strategy:
//! - If `HEIRVO_LS_PRODUCT_ID` is set at compile time (production builds),
//!   `validate_online` calls the Lemon Squeezy license API and verifies the
//!   key is active and belongs to this product.
//! - Otherwise (dev builds / CI), `validate_key` accepts any syntactically
//!   valid key (`XXXX-XXXX`, 8+ chars, contains `-`) — no network call.
//!
//! No phone-home for free users — privacy-preserving by default.

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Set at compile time when building for production.
/// `HEIRVO_LS_PRODUCT_ID=<your-ls-product-id> cargo tauri build`
const LS_PRODUCT_ID: Option<&str> = option_env!("HEIRVO_LS_PRODUCT_ID");
const LS_VALIDATE_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/validate";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Plan {
    Free,
    Pro,
}

#[derive(Debug, Clone, Serialize)]
pub struct LicenseStatus {
    pub plan: Plan,
    /// Email or short id of the buyer, if any.
    pub holder: Option<String>,
    /// Whether the SAVE features are unlocked.
    pub can_save: bool,
}

impl Default for LicenseStatus {
    fn default() -> Self {
        Self { plan: Plan::Free, holder: None, can_save: false }
    }
}

// ─── Lemon Squeezy response shapes ───────────────────────────────────────────

#[derive(Deserialize)]
struct LsValidateResp {
    valid: bool,
    license_key: LsLicenseKey,
    meta: LsMeta,
}

#[derive(Deserialize)]
struct LsLicenseKey {
    status: String, // "active" | "inactive" | "expired" | "disabled"
}

#[derive(Deserialize)]
struct LsMeta {
    customer_email: Option<String>,
    product_id: u64,
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

static CACHE: Mutex<Option<LicenseStatus>> = Mutex::new(None);

fn license_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("license.key")
}

// ─── Validation ───────────────────────────────────────────────────────────────

/// Dev-mode stub: accepts any non-empty key with at least one `-` and ≥8 chars.
/// Used when `HEIRVO_LS_PRODUCT_ID` is not set at build time.
pub fn validate_key(key: &str) -> Option<LicenseStatus> {
    let trimmed = key.trim();
    if trimmed.len() < 8 || !trimmed.contains('-') {
        return None;
    }
    Some(LicenseStatus {
        plan: Plan::Pro,
        holder: Some(trimmed.split('-').next().unwrap_or("").to_string()),
        can_save: true,
    })
}

/// Production validation via Lemon Squeezy.
/// Falls back to `validate_key` if `HEIRVO_LS_PRODUCT_ID` is not compiled in.
pub async fn validate_online(key: &str) -> Option<LicenseStatus> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return None;
    }

    let Some(product_id_str) = LS_PRODUCT_ID else {
        // Dev / CI build — use format check only.
        return validate_key(trimmed);
    };

    let product_id: u64 = product_id_str.parse().ok()?;

    let resp = reqwest::Client::new()
        .post(LS_VALIDATE_URL)
        .header("Accept", "application/json")
        .form(&[("license_key", trimmed)])
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let v: LsValidateResp = resp.json().await.ok()?;

    if !v.valid || v.license_key.status != "active" {
        return None;
    }
    if v.meta.product_id != product_id {
        return None; // Key is for a different product
    }

    Some(LicenseStatus {
        plan: Plan::Pro,
        holder: v.meta.customer_email,
        can_save: true,
    })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Read the on-disk license, if present, and cache the result.
/// Uses format-only validation on load (no network call on every launch).
pub fn current(app_data_dir: &PathBuf) -> LicenseStatus {
    if let Some(c) = CACHE.lock().unwrap().clone() {
        return c;
    }
    let p = license_path(app_data_dir);
    let status = match std::fs::read_to_string(&p) {
        Ok(key) => validate_key(&key).unwrap_or_default(),
        Err(_) => LicenseStatus::default(),
    };
    *CACHE.lock().unwrap() = Some(status.clone());
    status
}

/// Apply a new license key — validates online (LS in prod, format-only in dev),
/// persists to disk, and returns the new status. Errors if the key is invalid.
pub async fn activate(app_data_dir: &PathBuf, key: &str) -> AppResult<LicenseStatus> {
    let status = validate_online(key)
        .await
        .ok_or_else(|| AppError::Internal("Invalid license key".into()))?;
    std::fs::create_dir_all(app_data_dir).ok();
    std::fs::write(license_path(app_data_dir), key.trim())?;
    *CACHE.lock().unwrap() = Some(status.clone());
    Ok(status)
}

/// Remove the license (sign-out / refund). Returns the new (Free) status.
pub fn deactivate(app_data_dir: &PathBuf) -> LicenseStatus {
    let _ = std::fs::remove_file(license_path(app_data_dir));
    let s = LicenseStatus::default();
    *CACHE.lock().unwrap() = Some(s.clone());
    s
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Mutex as StdMutex, MutexGuard};

    static SEQ: AtomicU64 = AtomicU64::new(0);
    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    fn tmp_dir() -> PathBuf {
        let seq = SEQ.fetch_add(1, Ordering::SeqCst);
        let p = env::temp_dir()
            .join(format!("heirvo-lic-test-{}-{}", std::process::id(), seq));
        std::fs::create_dir_all(&p).ok();
        p
    }

    fn lock() -> MutexGuard<'static, ()> {
        TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner())
    }

    #[test]
    fn empty_key_is_rejected() {
        assert!(validate_key("").is_none());
        assert!(validate_key("   ").is_none());
    }

    #[test]
    fn short_key_is_rejected() {
        assert!(validate_key("AB-CD").is_none());
    }

    #[test]
    fn key_without_dash_is_rejected() {
        assert!(validate_key("ABCDEFGH12345").is_none());
    }

    #[test]
    fn well_formed_key_is_accepted_in_dev() {
        let s = validate_key("HEIRVO-PRO-1234").expect("should accept dev key");
        assert_eq!(s.plan, Plan::Pro);
        assert!(s.can_save);
        assert_eq!(s.holder.as_deref(), Some("HEIRVO"));
    }

    #[tokio::test]
    async fn activate_persists_and_round_trips() {
        let _g = lock();
        let dir = tmp_dir();
        *CACHE.lock().unwrap() = None;
        let s = activate(&dir, "TEST-KEY-1234").await.expect("activate ok");
        assert!(s.can_save);

        *CACHE.lock().unwrap() = None;
        let reloaded = current(&dir);
        assert!(reloaded.can_save);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn deactivate_clears_status() {
        let _g = lock();
        let dir = tmp_dir();
        *CACHE.lock().unwrap() = None;
        // Use a temporary runtime for the async activate
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(activate(&dir, "X-Y-Z-1234"))
            .ok();
        let s = deactivate(&dir);
        assert_eq!(s.plan, Plan::Free);
        assert!(!s.can_save);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn missing_license_returns_free() {
        let _g = lock();
        let dir = tmp_dir().join("never-existed");
        *CACHE.lock().unwrap() = None;
        let s = current(&dir);
        assert_eq!(s.plan, Plan::Free);
    }
}
