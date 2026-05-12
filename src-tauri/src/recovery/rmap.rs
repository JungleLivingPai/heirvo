//! ddrescue-compatible recovery mapfile (`.rmap`) encode + decode.
//!
//! GNU ddrescue's mapfile is a 20-year-stable text format: positions and sizes
//! are byte offsets in hex, status is a single character per run. Reusing this
//! format means our recovery state is interoperable — users can take an `.rmap`
//! from this app to ddrescue (or vice versa) and continue from where they left
//! off, including across different machines, OSes, and tool versions.
//!
//! ## Format
//!
//! ```text
//! # Mapfile produced by DVD Rescue 0.1.0
//! # Disc: <disc_label> (<fingerprint>)
//! # current_pos  current_status  current_pass
//! 0x0  ?  1
//! #      pos        size  status
//! 0x00000000  0x00100000  +
//! 0x00100000  0x00002000  -
//! 0x00102000  0x000fe000  +
//! ```
//!
//! ## Status character mapping
//!
//! | DVD Rescue   | ddrescue char | Meaning                             |
//! |--------------|---------------|-------------------------------------|
//! | `Unknown`    | `?`           | Non-tried — we never read it        |
//! | `Good`       | `+`           | Finished — readable                 |
//! | `Failed`     | `-`           | Bad-sector — unreadable             |
//! | `Skipped`    | `/`           | Non-scraped — known damaged region  |

use crate::disc::sector::DVD_SECTOR_SIZE;
use crate::recovery::map::{SectorMap, SectorState};

const SECTOR: u64 = DVD_SECTOR_SIZE as u64;

pub struct RmapHeader {
    pub disc_label: Option<String>,
    pub disc_fingerprint: Option<String>,
    pub current_pass: u32,
    pub app_version: &'static str,
}

impl Default for RmapHeader {
    fn default() -> Self {
        Self {
            disc_label: None,
            disc_fingerprint: None,
            current_pass: 1,
            app_version: env!("CARGO_PKG_VERSION"),
        }
    }
}

/// Encode a `SectorMap` to a ddrescue-format mapfile string.
pub fn encode(map: &SectorMap, header: &RmapHeader) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "# Mapfile produced by DVD Rescue {}\n",
        header.app_version
    ));
    if let Some(label) = &header.disc_label {
        out.push_str(&format!("# Disc: {}\n", label));
    }
    if let Some(fp) = &header.disc_fingerprint {
        out.push_str(&format!("# Fingerprint: {}\n", fp));
    }
    out.push_str(&format!("# Total sectors: {}\n", map.total()));
    out.push_str("# current_pos  current_status  current_pass\n");
    out.push_str(&format!("0x0  ?  {}\n", header.current_pass));
    out.push_str("#      pos        size  status\n");

    let total = map.total();
    if total == 0 {
        return out;
    }

    // Walk contiguous runs of identical state and emit one line per run.
    let mut run_start: u64 = 0;
    let mut current = map.get(0);
    for lba in 1..total {
        let s = map.get(lba);
        if s != current {
            emit_run(&mut out, run_start, lba - run_start, current);
            current = s;
            run_start = lba;
        }
    }
    emit_run(&mut out, run_start, total - run_start, current);
    out
}

fn emit_run(out: &mut String, start_lba: u64, len_sectors: u64, state: SectorState) {
    out.push_str(&format!(
        "0x{:08x}  0x{:08x}  {}\n",
        start_lba * SECTOR,
        len_sectors * SECTOR,
        state_char(state),
    ));
}

fn state_char(s: SectorState) -> char {
    match s {
        SectorState::Unknown => '?',
        SectorState::Good => '+',
        SectorState::Failed => '-',
        SectorState::Skipped => '/',
    }
}

fn char_state(c: char) -> Option<SectorState> {
    match c {
        '?' | '*' => Some(SectorState::Unknown),
        '+' => Some(SectorState::Good),
        '-' => Some(SectorState::Failed),
        '/' => Some(SectorState::Skipped),
        _ => None,
    }
}

/// Parse a ddrescue mapfile back into a `SectorMap`. Comments (lines starting
/// with `#`) and the `current_pos` status line are ignored. Each remaining
/// line must be `<pos>  <size>  <status>` with byte offsets.
///
/// `total_sectors` lets the caller size the output map; runs that fall past
/// the end are clamped.
pub fn decode(text: &str, total_sectors: u64) -> std::io::Result<SectorMap> {
    let mut map = SectorMap::new(total_sectors);
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.split_whitespace();
        let Some(pos_str) = parts.next() else { continue };
        let Some(size_str) = parts.next() else { continue };
        let Some(status_str) = parts.next() else { continue };

        // Skip the "current_pos  current_status  current_pass" line: its
        // middle column is a single status char, not a byte size.
        if size_str.len() == 1 {
            continue;
        }

        let pos = parse_hex_or_dec(pos_str)?;
        let size = parse_hex_or_dec(size_str)?;
        let Some(state) = status_str.chars().next().and_then(char_state) else {
            continue;
        };

        if size == 0 {
            continue;
        }
        let start_lba = pos / SECTOR;
        let len_sectors = size.div_ceil(SECTOR);
        let end_lba = (start_lba + len_sectors).min(total_sectors);
        for lba in start_lba..end_lba {
            map.set(lba, state);
        }
    }
    Ok(map)
}

fn parse_hex_or_dec(s: &str) -> std::io::Result<u64> {
    if let Some(rest) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u64::from_str_radix(rest, 16).map_err(|e| std::io::Error::other(e.to_string()))
    } else {
        s.parse::<u64>()
            .map_err(|e| std::io::Error::other(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_simple() {
        let mut m = SectorMap::new(100);
        for lba in 0..40 {
            m.set(lba, SectorState::Good);
        }
        for lba in 40..50 {
            m.set(lba, SectorState::Failed);
        }
        for lba in 50..100 {
            m.set(lba, SectorState::Good);
        }

        let text = encode(&m, &RmapHeader::default());
        let parsed = decode(&text, 100).unwrap();

        for lba in 0..100 {
            assert_eq!(m.get(lba), parsed.get(lba), "mismatch at {lba}");
        }
    }

    #[test]
    fn round_trip_all_states() {
        let mut m = SectorMap::new(40);
        for (i, lba) in (0..40).enumerate() {
            let s = match i % 4 {
                0 => SectorState::Unknown,
                1 => SectorState::Good,
                2 => SectorState::Failed,
                _ => SectorState::Skipped,
            };
            m.set(lba, s);
        }
        let text = encode(&m, &RmapHeader::default());
        let parsed = decode(&text, 40).unwrap();
        for lba in 0..40 {
            assert_eq!(m.get(lba), parsed.get(lba));
        }
    }

    #[test]
    fn parses_real_ddrescue_output() {
        // Minimal mapfile in canonical ddrescue format.
        let text = "# Mapfile produced by GNU ddrescue 1.27\n\
                    # Command line: ddrescue /dev/sr0 out.iso out.map\n\
                    # current_pos  current_status  current_pass\n\
                    0x123456  ?  1\n\
                    #      pos        size  status\n\
                    0x00000000  0x00100000  +\n\
                    0x00100000  0x00002000  -\n\
                    0x00102000  0x000fe000  +\n";
        // 0x100000 = 1MB = 512 sectors; 0x2000 = 8KB = 4 sectors;
        // 0xfe000 = 1016KB = 508 sectors. Total 1024 sectors.
        let map = decode(text, 1024).unwrap();
        assert_eq!(map.count(SectorState::Good), 1024 - 4);
        assert_eq!(map.count(SectorState::Failed), 4);
        assert_eq!(map.get(512), SectorState::Failed);
        assert_eq!(map.get(515), SectorState::Failed);
        assert_eq!(map.get(516), SectorState::Good);
    }

    #[test]
    fn header_includes_disc_metadata() {
        let m = SectorMap::new(1);
        let header = RmapHeader {
            disc_label: Some("WEDDING_DVD".into()),
            disc_fingerprint: Some("abc123".into()),
            current_pass: 2,
            app_version: "test",
        };
        let text = encode(&m, &header);
        assert!(text.contains("# Disc: WEDDING_DVD"));
        assert!(text.contains("# Fingerprint: abc123"));
        assert!(text.contains("0x0  ?  2"));
    }

    #[test]
    fn empty_map_emits_no_run_lines() {
        let m = SectorMap::new(0);
        let text = encode(&m, &RmapHeader::default());
        // Should still have headers but no `0x...` data lines.
        let data_lines: Vec<_> = text.lines().filter(|l| l.starts_with("0x") && !l.contains('?')).collect();
        assert!(data_lines.is_empty());
    }
}
