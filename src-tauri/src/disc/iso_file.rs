//! File-backed `SectorReader` for tests + future "resume from partial ISO".
//!
//! Reads 2048-byte sectors out of a regular file (e.g. a synthetic ISO).
//! Optionally takes a `bad_sectors` set so tests can simulate read failures
//! without ever touching real hardware.

use crate::disc::sector::{ReadOptions, SectorError, SectorReadResult, SectorReader, DVD_SECTOR_SIZE};
use parking_lot::Mutex;
use std::collections::HashSet;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

pub struct IsoFileSectorReader {
    file: Mutex<File>,
    capacity: u64,
    bad_sectors: HashSet<u64>,
}

impl IsoFileSectorReader {
    pub fn open(path: &Path) -> std::io::Result<Self> {
        Self::open_with_bad_sectors(path, HashSet::new())
    }

    pub fn open_with_bad_sectors(
        path: &Path,
        bad_sectors: HashSet<u64>,
    ) -> std::io::Result<Self> {
        let file = File::open(path)?;
        let size = file.metadata()?.len();
        let capacity = size / DVD_SECTOR_SIZE as u64;
        Ok(Self {
            file: Mutex::new(file),
            capacity,
            bad_sectors,
        })
    }

    /// Build a reader directly from in-memory bytes. Writes them to a temp
    /// file under the OS temp dir so the trait's file-handle lifecycle stays
    /// simple.
    #[cfg(test)]
    pub fn from_bytes(bytes: &[u8], bad_sectors: HashSet<u64>) -> std::io::Result<(Self, std::path::PathBuf)> {
        use std::io::Write;
        let mut path = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        path.push(format!("dvd-rescue-test-{stamp}.iso"));
        let mut f = File::create(&path)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        let reader = Self::open_with_bad_sectors(&path, bad_sectors)?;
        Ok((reader, path))
    }
}

impl SectorReader for IsoFileSectorReader {
    fn read_sector(&self, lba: u64, _opts: ReadOptions) -> SectorReadResult {
        if lba >= self.capacity {
            return SectorReadResult::err(lba, SectorError::IllegalRequest, 0, 0);
        }
        if self.bad_sectors.contains(&lba) {
            return SectorReadResult::err(lba, SectorError::MediumError, 1, 1);
        }
        let mut buf = vec![0u8; DVD_SECTOR_SIZE];
        let mut file = self.file.lock();
        if file
            .seek(SeekFrom::Start(lba * DVD_SECTOR_SIZE as u64))
            .is_err()
        {
            return SectorReadResult::err(lba, SectorError::Other, 1, 1);
        }
        match file.read_exact(&mut buf) {
            Ok(()) => SectorReadResult::ok(lba, buf, 1),
            Err(_) => SectorReadResult::err(lba, SectorError::Other, 1, 1),
        }
    }

    fn capacity(&self) -> u64 {
        self.capacity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_sector_from_file() {
        let mut bytes = vec![0u8; DVD_SECTOR_SIZE * 4];
        // Mark sector 2 with a recognizable pattern.
        bytes[DVD_SECTOR_SIZE * 2..DVD_SECTOR_SIZE * 2 + 3].copy_from_slice(&[0xAB, 0xCD, 0xEF]);
        let (reader, path) = IsoFileSectorReader::from_bytes(&bytes, HashSet::new()).unwrap();

        let r = reader.read_sector(2, ReadOptions::default());
        assert!(r.is_ok());
        let data = r.data.unwrap();
        assert_eq!(&data[..3], &[0xAB, 0xCD, 0xEF]);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn bad_sectors_return_medium_error() {
        let bytes = vec![0u8; DVD_SECTOR_SIZE * 4];
        let mut bad = HashSet::new();
        bad.insert(1);
        bad.insert(3);
        let (reader, path) = IsoFileSectorReader::from_bytes(&bytes, bad).unwrap();

        assert!(reader.read_sector(0, ReadOptions::default()).is_ok());
        let r1 = reader.read_sector(1, ReadOptions::default());
        assert!(!r1.is_ok());
        assert_eq!(r1.error, Some(SectorError::MediumError));
        assert!(reader.read_sector(2, ReadOptions::default()).is_ok());
        assert!(!reader.read_sector(3, ReadOptions::default()).is_ok());

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn capacity_matches_file_size() {
        let bytes = vec![0u8; DVD_SECTOR_SIZE * 17];
        let (reader, path) = IsoFileSectorReader::from_bytes(&bytes, HashSet::new()).unwrap();
        assert_eq!(reader.capacity(), 17);
        let _ = std::fs::remove_file(path);
    }
}
