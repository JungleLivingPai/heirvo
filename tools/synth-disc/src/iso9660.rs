//! Minimal ISO 9660 directory walker, file-backed.
//!
//! Independent of the main app — operates directly on a byte slice / file
//! mmap-style buffer. Layout reference (ECMA-119):
//!   sector 16 = Primary Volume Descriptor (PVD), magic "CD001" at offset 1
//!   PVD offset 156 = root directory record (34 bytes)
//!     bytes  2..6  = extent LBA (LE half of the both-endian u32)
//!     bytes 10..14 = data length (LE half)
//!   Directory record bytes:
//!     0       = record length (0 = pad to next sector)
//!     2..6    = extent LBA (LE)
//!     10..14  = data length (LE)
//!     25      = file flags (0x02 = directory)
//!     32      = name length
//!     33..    = name bytes (";1" version suffix stripped)

use anyhow::{anyhow, bail, Result};

pub const SECTOR_SIZE: usize = 2048;

#[derive(Debug, Clone)]
pub struct IsoEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub start_lba: u64,
    pub size_bytes: u64,
}

impl IsoEntry {
    pub fn sector_count(&self) -> u64 {
        (self.size_bytes + SECTOR_SIZE as u64 - 1) / SECTOR_SIZE as u64
    }
}

fn read_u32_le(b: &[u8]) -> u32 {
    u32::from_le_bytes([b[0], b[1], b[2], b[3]])
}

fn sector<'a>(image: &'a [u8], lba: u64) -> Result<&'a [u8]> {
    let start = (lba as usize) * SECTOR_SIZE;
    let end = start + SECTOR_SIZE;
    if end > image.len() {
        bail!("LBA {} out of range (image is {} bytes)", lba, image.len());
    }
    Ok(&image[start..end])
}

#[derive(Debug, Clone)]
pub struct IsoVolume {
    pub label: String,
    pub root_lba: u64,
    pub root_size: u64,
    pub total_sectors: u64,
}

pub fn read_volume(image: &[u8]) -> Result<IsoVolume> {
    let pvd = sector(image, 16)?;
    if pvd.len() < 190 || &pvd[1..6] != b"CD001" {
        bail!("not an ISO 9660 volume (missing CD001 magic at sector 16)");
    }
    let label = String::from_utf8_lossy(&pvd[40..72]).trim().to_string();
    let root_lba = read_u32_le(&pvd[158..162]) as u64;
    let root_size = read_u32_le(&pvd[166..170]) as u64;
    let total_sectors = read_u32_le(&pvd[80..84]) as u64;
    Ok(IsoVolume { label, root_lba, root_size, total_sectors })
}

fn read_directory(
    image: &[u8],
    start_lba: u64,
    size_bytes: u64,
    parent_path: &str,
) -> Result<Vec<IsoEntry>> {
    let sector_count = (size_bytes + SECTOR_SIZE as u64 - 1) / SECTOR_SIZE as u64;
    let mut buf = Vec::with_capacity(sector_count as usize * SECTOR_SIZE);
    for i in 0..sector_count {
        let s = sector(image, start_lba + i)?;
        buf.extend_from_slice(s);
    }

    let mut entries = Vec::new();
    let mut off = 0usize;
    while off < buf.len() {
        let len = buf[off] as usize;
        if len == 0 {
            let sector_off = off / SECTOR_SIZE * SECTOR_SIZE;
            let next = sector_off + SECTOR_SIZE;
            if next >= buf.len() {
                break;
            }
            off = next;
            continue;
        }
        if off + len > buf.len() || len < 33 {
            break;
        }
        let rec = &buf[off..off + len];
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

        if name_len == 1 && (name_bytes[0] == 0 || name_bytes[0] == 1) {
            off += len;
            continue;
        }

        let raw = String::from_utf8_lossy(name_bytes).to_string();
        let name = match raw.rfind(';') {
            Some(i) => raw[..i].to_string(),
            None => raw,
        };

        let path = if parent_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", parent_path, name)
        };

        entries.push(IsoEntry {
            name,
            path,
            is_dir,
            start_lba: extent_lba,
            size_bytes: data_len,
        });
        off += len;
    }

    Ok(entries)
}

/// Walk the entire filesystem recursively, returning a flat list of all
/// non-"."/".." entries (files and directories alike).
pub fn walk_all(image: &[u8]) -> Result<Vec<IsoEntry>> {
    let vol = read_volume(image)?;
    let mut out = Vec::new();
    let mut stack: Vec<(u64, u64, String)> =
        vec![(vol.root_lba, vol.root_size, "/".to_string())];
    while let Some((lba, size, path)) = stack.pop() {
        let entries = read_directory(image, lba, size, &path)?;
        for e in entries {
            if e.is_dir {
                stack.push((e.start_lba, e.size_bytes, e.path.clone()));
            }
            out.push(e);
        }
    }
    Ok(out)
}

/// Find a file by case-insensitive name (anywhere in the tree).
pub fn find_by_name<'a>(entries: &'a [IsoEntry], name: &str) -> Option<&'a IsoEntry> {
    entries
        .iter()
        .find(|e| !e.is_dir && e.name.eq_ignore_ascii_case(name))
}

/// Find all files whose name ends with the given (case-insensitive) suffix.
pub fn find_by_extension<'a>(entries: &'a [IsoEntry], ext: &str) -> Vec<&'a IsoEntry> {
    let ext_lower = ext.to_ascii_lowercase();
    entries
        .iter()
        .filter(|e| !e.is_dir && e.name.to_ascii_lowercase().ends_with(&ext_lower))
        .collect()
}

/// Lookup the lexicographically largest VOB file (typically VTS_NN_K.VOB).
pub fn largest_vob<'a>(entries: &'a [IsoEntry]) -> Option<&'a IsoEntry> {
    let vobs = find_by_extension(entries, ".VOB");
    vobs.into_iter().max_by(|a, b| a.name.cmp(&b.name))
        .map(|e| e)
        .or(None)
        .and_then(|_| {
            // Re-borrow trick: we already discarded vobs, redo to get original ref.
            let all = find_by_extension(entries, ".VOB");
            all.into_iter().max_by(|a, b| a.name.cmp(&b.name))
        })
}

pub fn missing_volume_error() -> anyhow::Error {
    anyhow!("could not parse ISO 9660 volume from input image")
}
