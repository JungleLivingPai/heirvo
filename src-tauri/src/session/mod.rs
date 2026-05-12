//! Session persistence — SQLite-backed recovery state and resume logic.

pub mod db;
pub mod manager;

pub use db::Db;
pub use manager::{Session, SessionStatus};
