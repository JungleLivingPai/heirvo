//! Sector map — packed 2-bit-per-sector state vector.
//!
//! For a single-layer DVD (~2.3M sectors), this is ~573KB uncompressed.
//! Persisted to SQLite as zstd-compressed BLOB.

use serde::{Deserialize, Serialize};

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectorState {
    Unknown = 0b00,
    Good = 0b01,
    Failed = 0b10,
    Skipped = 0b11,
}

impl SectorState {
    fn from_bits(bits: u8) -> Self {
        match bits & 0b11 {
            0b00 => SectorState::Unknown,
            0b01 => SectorState::Good,
            0b10 => SectorState::Failed,
            _ => SectorState::Skipped,
        }
    }
}

/// Packed 2-bits-per-sector map.
#[derive(Debug, Clone)]
pub struct SectorMap {
    total: u64,
    /// Each byte holds 4 sectors.
    bits: Vec<u8>,
}

impl SectorMap {
    pub fn new(total_sectors: u64) -> Self {
        let bytes = total_sectors.div_ceil(4) as usize;
        Self { total: total_sectors, bits: vec![0u8; bytes] }
    }

    pub fn total(&self) -> u64 {
        self.total
    }

    pub fn get(&self, lba: u64) -> SectorState {
        debug_assert!(lba < self.total);
        let byte_idx = (lba / 4) as usize;
        let shift = ((lba % 4) * 2) as u8;
        SectorState::from_bits(self.bits[byte_idx] >> shift)
    }

    pub fn set(&mut self, lba: u64, state: SectorState) {
        debug_assert!(lba < self.total);
        let byte_idx = (lba / 4) as usize;
        let shift = ((lba % 4) * 2) as u8;
        let mask = 0b11u8 << shift;
        self.bits[byte_idx] = (self.bits[byte_idx] & !mask) | ((state as u8) << shift);
    }

    /// Count sectors in a given state. O(n) — call sparingly, or cache via stats.
    pub fn count(&self, state: SectorState) -> u64 {
        let mut n = 0u64;
        for lba in 0..self.total {
            if self.get(lba) == state {
                n += 1;
            }
        }
        n
    }

    /// Iterate over contiguous runs of a given state.
    pub fn runs(&self, state: SectorState) -> impl Iterator<Item = (u64, u64)> + '_ {
        RunIterator { map: self, state, lba: 0 }
    }

    /// Compress to zstd for SQLite storage.
    pub fn to_compressed(&self) -> std::io::Result<Vec<u8>> {
        zstd::stream::encode_all(&self.bits[..], 6)
    }

    pub fn from_compressed(total: u64, bytes: &[u8]) -> std::io::Result<Self> {
        let bits = zstd::stream::decode_all(bytes)?;
        let expected = total.div_ceil(4) as usize;
        if bits.len() != expected {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("sector map size mismatch: got {} expected {}", bits.len(), expected),
            ));
        }
        Ok(Self { total, bits })
    }

    /// Down-sampled snapshot suitable for the frontend canvas (<= max_buckets entries).
    /// Each bucket reports the dominant state in its sector range.
    pub fn downsample(&self, max_buckets: usize) -> Vec<u8> {
        let buckets = max_buckets.min(self.total as usize).max(1);
        let per_bucket = (self.total as usize).div_ceil(buckets);
        let mut out = Vec::with_capacity(buckets);
        for b in 0..buckets {
            let start = (b * per_bucket) as u64;
            let end = ((b + 1) * per_bucket).min(self.total as usize) as u64;
            let mut counts = [0u32; 4];
            for lba in start..end {
                let s = self.get(lba) as u8 as usize;
                counts[s] += 1;
            }
            // Failed dominates visually if any sector failed.
            if counts[SectorState::Failed as usize] > 0 {
                out.push(SectorState::Failed as u8);
            } else if counts[SectorState::Good as usize] >= counts[SectorState::Unknown as usize] {
                out.push(SectorState::Good as u8);
            } else if counts[SectorState::Skipped as usize] > 0 {
                out.push(SectorState::Skipped as u8);
            } else {
                out.push(SectorState::Unknown as u8);
            }
        }
        out
    }
}

pub struct RunIterator<'a> {
    map: &'a SectorMap,
    state: SectorState,
    lba: u64,
}

impl Iterator for RunIterator<'_> {
    type Item = (u64, u64);
    fn next(&mut self) -> Option<Self::Item> {
        while self.lba < self.map.total && self.map.get(self.lba) != self.state {
            self.lba += 1;
        }
        if self.lba >= self.map.total {
            return None;
        }
        let start = self.lba;
        while self.lba < self.map.total && self.map.get(self.lba) == self.state {
            self.lba += 1;
        }
        Some((start, self.lba))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_and_get() {
        let mut m = SectorMap::new(100);
        m.set(0, SectorState::Good);
        m.set(1, SectorState::Failed);
        m.set(99, SectorState::Skipped);
        assert_eq!(m.get(0), SectorState::Good);
        assert_eq!(m.get(1), SectorState::Failed);
        assert_eq!(m.get(2), SectorState::Unknown);
        assert_eq!(m.get(99), SectorState::Skipped);
    }

    #[test]
    fn round_trip_compressed() {
        let mut m = SectorMap::new(10_000);
        for lba in 0..10_000 {
            m.set(lba, if lba % 3 == 0 { SectorState::Good } else { SectorState::Unknown });
        }
        let bytes = m.to_compressed().unwrap();
        let m2 = SectorMap::from_compressed(10_000, &bytes).unwrap();
        for lba in 0..10_000 {
            assert_eq!(m.get(lba), m2.get(lba));
        }
    }

    #[test]
    fn run_iteration() {
        let mut m = SectorMap::new(20);
        for lba in 5..10 {
            m.set(lba, SectorState::Good);
        }
        for lba in 15..18 {
            m.set(lba, SectorState::Good);
        }
        let runs: Vec<_> = m.runs(SectorState::Good).collect();
        assert_eq!(runs, vec![(5, 10), (15, 18)]);
    }
}
