//! DVD structure analysis (VIDEO_TS, IFO/BUP parsing).
//!
//! Phase 1 stub. Full IFO parser to be implemented in `ifo.rs`.

pub mod ifo;
pub mod iso9660;
pub mod structure;

#[cfg(test)]
pub mod test_iso;

pub use structure::{Chapter, DvdStructure, Title};
