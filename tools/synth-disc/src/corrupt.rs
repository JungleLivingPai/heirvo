//! Corruption operations applied to an in-memory ISO image buffer.

use crate::iso9660::{self, IsoEntry, SECTOR_SIZE};
use crate::manifest::{CorruptionRecord, Manifest};
use anyhow::{bail, Context, Result};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::{CorruptionRecord, Manifest};
    use std::path::PathBuf;

    /// Build a 1 MiB synthetic ISO with a valid PVD pointing at a tiny root dir.
    fn synthetic_iso() -> Vec<u8> {
        const TOTAL: usize = 512;
        let mut buf = vec![0u8; TOTAL * SECTOR_SIZE];
        let off = 16 * SECTOR_SIZE;
        buf[off] = 1;
        buf[off + 1..off + 6].copy_from_slice(b"CD001");
        buf[off + 6] = 1;
        let le = (TOTAL as u32).to_le_bytes();
        let be = (TOTAL as u32).to_be_bytes();
        buf[off + 80..off + 84].copy_from_slice(&le);
        buf[off + 84..off + 88].copy_from_slice(&be);
        let r = off + 156;
        buf[r] = 34;
        let root_lba: u32 = 18;
        buf[r + 2..r + 6].copy_from_slice(&root_lba.to_le_bytes());
        buf[r + 6..r + 10].copy_from_slice(&root_lba.to_be_bytes());
        let root_size: u32 = 2048;
        buf[r + 10..r + 14].copy_from_slice(&root_size.to_le_bytes());
        buf[r + 14..r + 18].copy_from_slice(&root_size.to_be_bytes());
        buf[r + 25] = 0x02;
        buf[r + 32] = 1;
        buf[r + 33] = 0;
        // Pre-fill all sectors with non-zero so we can detect zeroing.
        for i in 0..TOTAL {
            if i != 16 && i != 18 {
                let s = i * SECTOR_SIZE;
                for b in &mut buf[s..s + SECTOR_SIZE] {
                    *b = 0xAB;
                }
            }
        }
        buf
    }

    #[test]
    fn random_bad_sectors_zeroes_correct_count() {
        let mut img = synthetic_iso();
        let mut m = Manifest::new(&PathBuf::from("a"), &PathBuf::from("b"), "x");
        random_bad_sectors(&mut img, &mut m, 7, 99).unwrap();
        assert_eq!(m.records.len(), 7);
        for r in &m.records {
            if let CorruptionRecord::ZeroedSectors { start_lba, .. } = r {
                let s = (*start_lba as usize) * SECTOR_SIZE;
                assert!(img[s..s + SECTOR_SIZE].iter().all(|b| *b == 0));
            } else {
                panic!("wrong record kind");
            }
        }
    }

    #[test]
    fn unfinalized_kills_cd001_magic() {
        let mut img = synthetic_iso();
        let mut m = Manifest::new(&PathBuf::from("a"), &PathBuf::from("b"), "x");
        unfinalized(&mut img, &mut m).unwrap();
        let off = 16 * SECTOR_SIZE;
        assert_ne!(&img[off + 1..off + 6], b"CD001");
        assert_eq!(m.records.len(), 1);
    }

    #[test]
    fn contiguous_range_zeroes_run() {
        let mut img = synthetic_iso();
        let mut m = Manifest::new(&PathBuf::from("a"), &PathBuf::from("b"), "x");
        contiguous_range(&mut img, &mut m, 100, 5).unwrap();
        let s = 100 * SECTOR_SIZE;
        let e = 105 * SECTOR_SIZE;
        assert!(img[s..e].iter().all(|b| *b == 0));
        // Sector 99 should still be untouched.
        assert!(img[99 * SECTOR_SIZE..100 * SECTOR_SIZE].iter().any(|b| *b == 0xAB));
    }
}

/// Zero a single sector in the image.
fn zero_sector(image: &mut [u8], lba: u64) -> Result<()> {
    let start = (lba as usize) * SECTOR_SIZE;
    let end = start + SECTOR_SIZE;
    if end > image.len() {
        bail!("LBA {} out of range", lba);
    }
    for b in &mut image[start..end] {
        *b = 0;
    }
    Ok(())
}

fn zero_range(image: &mut [u8], start_lba: u64, length: u64) -> Result<()> {
    let start = (start_lba as usize) * SECTOR_SIZE;
    let end = start + (length as usize) * SECTOR_SIZE;
    if end > image.len() {
        bail!(
            "range {}..{} extends past end of image ({} sectors)",
            start_lba,
            start_lba + length,
            image.len() / SECTOR_SIZE
        );
    }
    for b in &mut image[start..end] {
        *b = 0;
    }
    Ok(())
}

/// Pick `count` random distinct LBAs in [0, total_sectors) using the given seed.
pub fn pick_random_lbas(total_sectors: u64, count: u64, seed: u64) -> Vec<u64> {
    if count == 0 || total_sectors == 0 {
        return Vec::new();
    }
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    let count = count.min(total_sectors);
    // For modest disc sizes (<= a few GB) building a candidate pool is fine.
    // Skip the first 16 sectors (system area) so we hit data sectors not the
    // boot region. (PVD is 16; we still allow corrupting it randomly above.)
    let pool_start: u64 = 16;
    if total_sectors <= pool_start {
        return Vec::new();
    }
    let mut pool: Vec<u64> = (pool_start..total_sectors).collect();
    pool.shuffle(&mut rng);
    pool.truncate(count as usize);
    pool.sort_unstable();
    pool
}

pub fn random_bad_sectors(
    image: &mut [u8],
    manifest: &mut Manifest,
    count: u64,
    seed: u64,
) -> Result<()> {
    let total = (image.len() / SECTOR_SIZE) as u64;
    let lbas = pick_random_lbas(total, count, seed);
    manifest.seed = Some(seed);
    for lba in lbas {
        zero_sector(image, lba)?;
        manifest.push(CorruptionRecord::ZeroedSectors {
            start_lba: lba,
            length: 1,
            reason: format!("random bad sector (seed={})", seed),
        });
    }
    Ok(())
}

pub fn contiguous_range(
    image: &mut [u8],
    manifest: &mut Manifest,
    start_lba: u64,
    length: u64,
) -> Result<()> {
    zero_range(image, start_lba, length)?;
    manifest.push(CorruptionRecord::ZeroedSectors {
        start_lba,
        length,
        reason: "contiguous scratch simulation".into(),
    });
    Ok(())
}

fn zero_file_extent(
    image: &mut [u8],
    manifest: &mut Manifest,
    entry: &IsoEntry,
) -> Result<()> {
    let sectors = entry.sector_count();
    if sectors == 0 {
        return Ok(());
    }
    zero_range(image, entry.start_lba, sectors)?;
    manifest.push(CorruptionRecord::ZeroedFile {
        path: entry.path.clone(),
        start_lba: entry.start_lba,
        length_sectors: sectors,
        size_bytes: entry.size_bytes,
    });
    Ok(())
}

pub fn corrupt_ifo(image: &mut [u8], manifest: &mut Manifest) -> Result<()> {
    let entries = iso9660::walk_all(image).context("walking ISO 9660 tree")?;
    let mut hit = false;
    for e in &entries {
        if !e.is_dir && e.name.to_ascii_uppercase().ends_with(".IFO") {
            zero_file_extent(image, manifest, e)?;
            hit = true;
        }
    }
    if !hit {
        bail!("no .IFO files found in image");
    }
    Ok(())
}

pub fn missing_bup(image: &mut [u8], manifest: &mut Manifest) -> Result<()> {
    let entries = iso9660::walk_all(image).context("walking ISO 9660 tree")?;
    let mut hit = false;
    for e in &entries {
        if !e.is_dir && e.name.to_ascii_uppercase().ends_with(".BUP") {
            zero_file_extent(image, manifest, e)?;
            hit = true;
        }
    }
    if !hit {
        bail!("no .BUP files found in image");
    }
    Ok(())
}

/// Truncates the *image file itself* by N bytes, simulating the last VOB
/// being cut short. Returns the new image length so the caller can resize.
pub fn truncate_vobs_bytes(
    image: &[u8],
    manifest: &mut Manifest,
    bytes: u64,
) -> Result<u64> {
    let entries = iso9660::walk_all(image).context("walking ISO 9660 tree")?;
    let largest = iso9660::largest_vob(&entries)
        .ok_or_else(|| anyhow::anyhow!("no .VOB files found in image"))?;
    let max_truncate = largest.size_bytes;
    let actual = bytes.min(max_truncate);
    let new_size = largest.size_bytes - actual;
    manifest.push(CorruptionRecord::TruncatedFile {
        path: largest.path.clone(),
        bytes_removed: actual,
        new_size,
    });
    // We can't shrink the in-place ISO without rewriting the directory record;
    // instead we trim the trailing bytes of the image as a whole, which
    // simulates a partial write at the tail.
    let last_byte_of_file =
        (largest.start_lba * SECTOR_SIZE as u64) + largest.size_bytes;
    let new_image_len = last_byte_of_file - actual;
    manifest.push(CorruptionRecord::TruncatedImage {
        bytes_removed: (image.len() as u64).saturating_sub(new_image_len),
        new_size: new_image_len,
    });
    Ok(new_image_len)
}

pub fn unfinalized(image: &mut [u8], manifest: &mut Manifest) -> Result<()> {
    let pvd_start = 16 * SECTOR_SIZE;
    if pvd_start + SECTOR_SIZE > image.len() {
        bail!("image too small to contain PVD");
    }
    // Wipe the CD001 magic at offset 1..6 of sector 16 so an OS will refuse
    // to mount it as ISO 9660. This simulates an unfinalised disc.
    for i in 1..6 {
        image[pvd_start + i] = 0;
    }
    manifest.push(CorruptionRecord::InvalidatedVolumeDescriptor { sector: 16 });
    Ok(())
}
