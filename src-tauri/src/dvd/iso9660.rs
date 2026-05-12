//! Minimal ISO 9660 reader.
//!
//! Just enough to walk the root directory of a DVD-Video disc and locate
//! the VIDEO_TS folder, its IFO/BUP/VOB files, and their sector extents.
//!
//! Spec reference: ECMA-119 (ISO 9660:1988).
//!
//! Layout:
//!   sector 16 = Primary Volume Descriptor (PVD)
//!     bytes 156..190  = root directory record (34 bytes)
//!       bytes 2..10   = extent location (LBA, both-endian u32)
//!       bytes 10..18  = data length (bytes, both-endian u32)
//!
//! Directory records are variable length; first byte is record length (0 = pad to next sector).

use crate::disc::sector::{ReadOptions, SectorReader, DVD_SECTOR_SIZE};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsoEntry {
    pub name: String,
    pub is_dir: bool,
    /// First sector of file/dir data.
    pub start_lba: u64,
    pub size_bytes: u64,
}

impl IsoEntry {
    /// Number of full sectors occupied (rounded up).
    pub fn sector_count(&self) -> u64 {
        self.size_bytes.div_ceil(DVD_SECTOR_SIZE as u64)
    }

    pub fn end_lba_exclusive(&self) -> u64 {
        self.start_lba + self.sector_count()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsoDirectory {
    pub path: String,
    pub entries: Vec<IsoEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsoVolume {
    pub label: String,
    pub root_lba: u64,
    pub root_size: u64,
    pub total_sectors: u64,
}

fn read_u32_le(b: &[u8]) -> u32 {
    u32::from_le_bytes([b[0], b[1], b[2], b[3]])
}

/// Parse the Primary Volume Descriptor at sector 16.
pub fn read_volume(reader: &dyn SectorReader) -> std::io::Result<IsoVolume> {
    let res = reader.read_sector(16, ReadOptions::default());
    let data = res
        .data
        .ok_or_else(|| std::io::Error::other("PVD sector 16 unreadable"))?;
    if data.len() < 190 || &data[1..6] != b"CD001" {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "not an ISO 9660 volume",
        ));
    }
    let label = String::from_utf8_lossy(&data[40..72]).trim().to_string();
    // Root directory record at offset 156 (length byte first).
    let root_lba = read_u32_le(&data[158..162]) as u64;
    let root_size = read_u32_le(&data[166..170]) as u64;
    // Total sectors = volume space size at offset 80 (both-endian).
    let total_sectors = read_u32_le(&data[80..84]) as u64;
    Ok(IsoVolume { label, root_lba, root_size, total_sectors })
}

/// Read the directory at the given LBA / byte length and return its entries.
pub fn read_directory(
    reader: &dyn SectorReader,
    start_lba: u64,
    size_bytes: u64,
    path: &str,
) -> std::io::Result<IsoDirectory> {
    let sector_count = size_bytes.div_ceil(DVD_SECTOR_SIZE as u64);
    let mut buf = Vec::with_capacity((sector_count * DVD_SECTOR_SIZE as u64) as usize);
    for i in 0..sector_count {
        let res = reader.read_sector(start_lba + i, ReadOptions::default());
        match res.data {
            Some(d) => buf.extend_from_slice(&d),
            None => buf.extend_from_slice(&[0u8; DVD_SECTOR_SIZE]),
        }
    }

    let mut entries = Vec::new();
    let mut off = 0usize;
    while off < buf.len() {
        let len = buf[off] as usize;
        if len == 0 {
            // Pad to next logical sector.
            let sector_off = off / DVD_SECTOR_SIZE * DVD_SECTOR_SIZE;
            let next = sector_off + DVD_SECTOR_SIZE;
            if next >= buf.len() {
                break;
            }
            off = next;
            continue;
        }
        if off + len > buf.len() {
            break;
        }
        let rec = &buf[off..off + len];
        if rec.len() < 33 {
            off += len;
            continue;
        }
        let extent_lba = read_u32_le(&rec[2..6]) as u64;
        let data_len = read_u32_le(&rec[10..14]) as u64;
        let flags = rec[25];
        let name_len = rec[32] as usize;
        if 33 + name_len > rec.len() {
            off += len;
            continue;
        }
        let name_bytes = &rec[33..33 + name_len];
        let is_dir = (flags & 0x02) != 0;

        // Skip the synthetic "." (0x00) and ".." (0x01) records.
        if name_len == 1 && (name_bytes[0] == 0 || name_bytes[0] == 1) {
            off += len;
            continue;
        }

        // Strip ISO9660 ";1" version suffix.
        let raw = String::from_utf8_lossy(name_bytes).to_string();
        let name = match raw.rfind(';') {
            Some(i) => raw[..i].to_string(),
            None => raw,
        };

        entries.push(IsoEntry { name, is_dir, start_lba: extent_lba, size_bytes: data_len });
        off += len;
    }

    Ok(IsoDirectory { path: path.to_string(), entries })
}

/// Walk the disc and return all files under VIDEO_TS, if present.
/// Walk the entire ISO 9660 tree and return every file with its name set to
/// the relative path (e.g. "PHOTOS/2003/IMG_1042.JPG"). Used for data-disc
/// recovery where there's no VIDEO_TS — just files the user wants back.
///
/// Quietly skips subdirectories that fail to read (damage in directory
/// blocks); we'd rather return what's readable than abort the whole walk.
pub fn walk_all_files(reader: &dyn SectorReader) -> std::io::Result<Vec<IsoEntry>> {
    let vol = read_volume(reader)?;
    let mut out = Vec::new();
    walk_dir(reader, vol.root_lba, vol.root_size, "", &mut out, 0);
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

/// Bounded-depth recursive walk. Cap depth at 16 to avoid pathological
/// crafted/corrupted discs that point dirs back at themselves.
fn walk_dir(
    reader: &dyn SectorReader,
    lba: u64,
    size: u64,
    rel: &str,
    out: &mut Vec<IsoEntry>,
    depth: u32,
) {
    if depth > 16 { return; }
    let dir = match read_directory(reader, lba, size, rel) {
        Ok(d) => d,
        Err(_) => return,
    };
    for e in dir.entries {
        // Skip ISO 9660 self/parent entries — read_directory may already
        // strip them but be defensive.
        if e.name == "." || e.name == ".." || e.name.is_empty() {
            continue;
        }
        let path = if rel.is_empty() {
            e.name.clone()
        } else {
            format!("{}/{}", rel.trim_start_matches('/'), e.name)
        };
        if e.is_dir {
            walk_dir(reader, e.start_lba, e.size_bytes, &path, out, depth + 1);
        } else {
            out.push(IsoEntry { name: path, is_dir: false, start_lba: e.start_lba, size_bytes: e.size_bytes });
        }
    }
}

pub fn list_video_ts(reader: &dyn SectorReader) -> std::io::Result<Option<Vec<IsoEntry>>> {
    let vol = read_volume(reader)?;
    let root = read_directory(reader, vol.root_lba, vol.root_size, "/")?;
    let video_ts = root
        .entries
        .iter()
        .find(|e| e.is_dir && e.name.eq_ignore_ascii_case("VIDEO_TS"));
    let Some(dir) = video_ts else { return Ok(None) };
    let listing = read_directory(reader, dir.start_lba, dir.size_bytes, "/VIDEO_TS")?;
    let mut files: Vec<_> = listing.entries.into_iter().filter(|e| !e.is_dir).collect();
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(Some(files))
}
