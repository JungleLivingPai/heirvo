//! Native IFO/BUP parser.
//!
//! TODO Phase 1: implement parser per DVD-Video specification.
//!   - VIDEO_TS.IFO  (VMGI) — disc-level title pointers, sector @ 0x0C
//!   - VTS_NN_0.IFO  (VTSI) — title set info, PGC, audio/sub streams
//!   - BUP files are byte-identical backups; fall back when IFO is unreadable
//!
//! For now, returns a minimal placeholder structure.

use crate::dvd::structure::DvdStructure;
use crate::error::{AppError, AppResult};
use std::path::Path;

pub fn parse_video_ts_dir(_path: &Path) -> AppResult<DvdStructure> {
    Err(AppError::NotImplemented("dvd::ifo::parse_video_ts_dir"))
}
