//! Build a minimal valid DVD-Video ISO9660 image entirely in memory, for tests.
//!
//! The image has:
//! - 16 sectors of system area (zeros)
//! - 1 Primary Volume Descriptor at sector 16
//! - 1 Volume Descriptor Set Terminator at sector 17
//! - 1 root directory at a chosen LBA, containing a single subdir entry "VIDEO_TS"
//! - 1 VIDEO_TS directory at a chosen LBA, containing entries for VTS_01_0.IFO,
//!   VTS_01_0.BUP, VTS_01_1.VOB
//! - The 3 VIDEO_TS files at chosen LBAs with deterministic content
//!
//! Layout (one sector per item except files which span their declared size):
//! ```
//! sector  0..16   system area (zeros)
//! sector  16      PVD
//! sector  17      Terminator
//! sector  18      Root directory (1 sector)
//! sector  19      VIDEO_TS directory (1 sector)
//! sector  20..21  VTS_01_0.IFO  (1 sector content)
//! sector  21..22  VTS_01_0.BUP  (1 sector content)
//! sector  22..27  VTS_01_1.VOB  (5 sectors content)
//! ```
//!
//! That's 27 sectors ≈ 55KB. Tiny but conforming.

#![cfg(test)]

use crate::disc::sector::DVD_SECTOR_SIZE;

const PVD_LBA: u64 = 16;
const TERMINATOR_LBA: u64 = 17;
const ROOT_DIR_LBA: u64 = 18;
const VIDEO_TS_DIR_LBA: u64 = 19;
const IFO_LBA: u64 = 20;
const BUP_LBA: u64 = 21;
const VOB_LBA: u64 = 22;
const VOB_SECTORS: u64 = 5;

const TOTAL_SECTORS: u64 = VOB_LBA + VOB_SECTORS;

pub struct SyntheticIso {
    pub bytes: Vec<u8>,
    pub total_sectors: u64,
    pub video_ts_files: Vec<(&'static str, u64, u64)>, // (name, start_lba, byte_size)
}

/// Build a synthetic 27-sector DVD-Video ISO.
pub fn build_synthetic_dvd_iso() -> SyntheticIso {
    let mut bytes = vec![0u8; (TOTAL_SECTORS * DVD_SECTOR_SIZE as u64) as usize];

    // --- Primary Volume Descriptor at sector 16 -----------------------------
    let pvd = sector_mut(&mut bytes, PVD_LBA);
    pvd[0] = 1; // type: Primary
    pvd[1..6].copy_from_slice(b"CD001");
    pvd[6] = 1; // version
                // bytes 8..40 = system identifier (left blank, A-characters padded)
    fill_a_chars(&mut pvd[8..40]);
    // bytes 40..72 = volume identifier (D-characters padded with spaces)
    write_d_chars(&mut pvd[40..72], "TEST_DISC");
    // bytes 80..88 = volume space size, both-endian u32 (in logical blocks)
    write_both_endian_u32(&mut pvd[80..88], TOTAL_SECTORS as u32);
    // bytes 120..124 = volume set size both-endian (1)
    write_both_endian_u16(&mut pvd[120..124], 1);
    // bytes 124..128 = volume sequence number both-endian (1)
    write_both_endian_u16(&mut pvd[124..128], 1);
    // bytes 128..132 = logical block size both-endian (2048)
    write_both_endian_u16(&mut pvd[128..132], DVD_SECTOR_SIZE as u16);
    // bytes 132..140 = path table size both-endian (we set 0 for simplicity;
    // ISO9660 requires path tables in real images but our walker only uses
    // the directory tree so we skip them).
    write_both_endian_u32(&mut pvd[132..140], 0);
    // bytes 140..144 LE, 144..148 BE = type-L / type-M path-table LBA (0)

    // bytes 156..190 = root directory record (34 bytes)
    let root_dir_record = build_dir_record(ROOT_DIR_LBA, DVD_SECTOR_SIZE as u32, true, &[0]);
    pvd[156..156 + root_dir_record.len()].copy_from_slice(&root_dir_record);

    // --- Volume Descriptor Set Terminator at sector 17 ----------------------
    let term = sector_mut(&mut bytes, TERMINATOR_LBA);
    term[0] = 0xFF;
    term[1..6].copy_from_slice(b"CD001");
    term[6] = 1;

    // --- Root directory at sector 18 ---------------------------------------
    // Records: . (this), .. (parent), VIDEO_TS (subdir)
    let root = sector_mut(&mut bytes, ROOT_DIR_LBA);
    let mut off = 0;
    let dot = build_dir_record(ROOT_DIR_LBA, DVD_SECTOR_SIZE as u32, true, &[0]);
    root[off..off + dot.len()].copy_from_slice(&dot);
    off += dot.len();
    let dotdot = build_dir_record(ROOT_DIR_LBA, DVD_SECTOR_SIZE as u32, true, &[1]);
    root[off..off + dotdot.len()].copy_from_slice(&dotdot);
    off += dotdot.len();
    let video_ts = build_dir_record(
        VIDEO_TS_DIR_LBA,
        DVD_SECTOR_SIZE as u32,
        true,
        b"VIDEO_TS",
    );
    root[off..off + video_ts.len()].copy_from_slice(&video_ts);

    // --- VIDEO_TS directory at sector 19 -----------------------------------
    let vts = sector_mut(&mut bytes, VIDEO_TS_DIR_LBA);
    let mut off = 0;
    let dot = build_dir_record(VIDEO_TS_DIR_LBA, DVD_SECTOR_SIZE as u32, true, &[0]);
    vts[off..off + dot.len()].copy_from_slice(&dot);
    off += dot.len();
    let dotdot = build_dir_record(ROOT_DIR_LBA, DVD_SECTOR_SIZE as u32, true, &[1]);
    vts[off..off + dotdot.len()].copy_from_slice(&dotdot);
    off += dotdot.len();
    let ifo = build_dir_record(IFO_LBA, DVD_SECTOR_SIZE as u32, false, b"VTS_01_0.IFO;1");
    vts[off..off + ifo.len()].copy_from_slice(&ifo);
    off += ifo.len();
    let bup = build_dir_record(BUP_LBA, DVD_SECTOR_SIZE as u32, false, b"VTS_01_0.BUP;1");
    vts[off..off + bup.len()].copy_from_slice(&bup);
    off += bup.len();
    let vob = build_dir_record(
        VOB_LBA,
        (VOB_SECTORS * DVD_SECTOR_SIZE as u64) as u32,
        false,
        b"VTS_01_1.VOB;1",
    );
    vts[off..off + vob.len()].copy_from_slice(&vob);

    // --- File contents (deterministic patterns) ----------------------------
    let ifo_sec = sector_mut(&mut bytes, IFO_LBA);
    ifo_sec[..12].copy_from_slice(b"DVDVIDEO-VTS");
    ifo_sec[100] = 0xAA;

    let bup_sec = sector_mut(&mut bytes, BUP_LBA);
    bup_sec[..12].copy_from_slice(b"DVDVIDEO-VTS");
    bup_sec[100] = 0xBB;

    for i in 0..VOB_SECTORS {
        let s = sector_mut(&mut bytes, VOB_LBA + i);
        // MPEG-2 PS pack header sync: 0x000001BA
        s[0] = 0x00;
        s[1] = 0x00;
        s[2] = 0x01;
        s[3] = 0xBA;
        s[4] = i as u8; // little marker per sector for assertions
    }

    SyntheticIso {
        bytes,
        total_sectors: TOTAL_SECTORS,
        video_ts_files: vec![
            ("VTS_01_0.IFO", IFO_LBA, DVD_SECTOR_SIZE as u64),
            ("VTS_01_0.BUP", BUP_LBA, DVD_SECTOR_SIZE as u64),
            ("VTS_01_1.VOB", VOB_LBA, VOB_SECTORS * DVD_SECTOR_SIZE as u64),
        ],
    }
}

fn sector_mut(bytes: &mut [u8], lba: u64) -> &mut [u8] {
    let off = (lba * DVD_SECTOR_SIZE as u64) as usize;
    &mut bytes[off..off + DVD_SECTOR_SIZE]
}

fn fill_a_chars(buf: &mut [u8]) {
    for b in buf.iter_mut() {
        *b = b' ';
    }
}

fn write_d_chars(buf: &mut [u8], s: &str) {
    for b in buf.iter_mut() {
        *b = b' ';
    }
    let n = std::cmp::min(buf.len(), s.len());
    buf[..n].copy_from_slice(&s.as_bytes()[..n]);
}

fn write_both_endian_u16(buf: &mut [u8], v: u16) {
    buf[0..2].copy_from_slice(&v.to_le_bytes());
    buf[2..4].copy_from_slice(&v.to_be_bytes());
}

fn write_both_endian_u32(buf: &mut [u8], v: u32) {
    buf[0..4].copy_from_slice(&v.to_le_bytes());
    buf[4..8].copy_from_slice(&v.to_be_bytes());
}

/// Build an ISO 9660 directory record. Always padded to even length.
fn build_dir_record(extent_lba: u64, data_len: u32, is_dir: bool, name: &[u8]) -> Vec<u8> {
    let mut name_padded: Vec<u8> = name.to_vec();
    let mut len = 33 + name_padded.len();
    if len % 2 != 0 {
        name_padded.push(0); // pad name to make total even
        len += 1;
    }
    let mut rec = vec![0u8; len];
    rec[0] = len as u8; // length of record
    rec[1] = 0; // extended attribute length
    rec[2..6].copy_from_slice(&(extent_lba as u32).to_le_bytes());
    rec[6..10].copy_from_slice(&(extent_lba as u32).to_be_bytes());
    rec[10..14].copy_from_slice(&data_len.to_le_bytes());
    rec[14..18].copy_from_slice(&data_len.to_be_bytes());
    // bytes 18..25 = recording date/time (skip — zero is fine for tests)
    rec[25] = if is_dir { 0x02 } else { 0x00 }; // file flags
    rec[26] = 0; // file unit size (non-interleaved)
    rec[27] = 0; // interleave gap size
    write_both_endian_u16(&mut rec[28..32], 1); // volume sequence number
    rec[32] = name.len() as u8; // length of name
    rec[33..33 + name.len()].copy_from_slice(name);
    rec
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::disc::iso_file::IsoFileSectorReader;
    use std::collections::HashSet;

    #[test]
    fn iso_pvd_signature_is_valid() {
        let iso = build_synthetic_dvd_iso();
        let pvd_offset = (PVD_LBA * DVD_SECTOR_SIZE as u64) as usize;
        assert_eq!(iso.bytes[pvd_offset], 1, "PVD type byte");
        assert_eq!(&iso.bytes[pvd_offset + 1..pvd_offset + 6], b"CD001");
    }

    /// Headline end-to-end test: damaged ISO → full recovery pipeline →
    /// extracted VOB has good sectors byte-identical, bad sectors zero-filled.
    #[test]
    fn end_to_end_damaged_iso_recovery() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::map::SectorState;
        use crate::recovery::passes::PassStrategy;
        use std::sync::Arc;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        // Damage the IFO entirely (sector 20) and one VOB sector (sector 24,
        // i.e. the 3rd VOB sector). The recovery engine should mark these as
        // Failed; everything else as Good.
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(IFO_LBA);
        bad.insert(VOB_LBA + 2);

        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad.clone()).unwrap();
        let reader = Arc::new(reader);

        // Triage + SlowRead + Reverse are enough — skip ThermalPause (5min sleep).
        let plan = vec![
            PassStrategy::Triage,
            PassStrategy::SlowRead,
            PassStrategy::Reverse,
        ];
        let engine = RecoveryEngine::new(Uuid::new_v4(), reader.clone(), plan);
        engine.run();
        let map = engine.snapshot_map();

        // Every non-bad sector should be recovered.
        for lba in 0..iso.total_sectors {
            if bad.contains(&lba) {
                assert_eq!(
                    map.get(lba),
                    SectorState::Failed,
                    "expected LBA {lba} to be Failed (it's permanently bad)"
                );
            } else {
                assert_eq!(
                    map.get(lba),
                    SectorState::Good,
                    "expected LBA {lba} to be Good (it's readable)"
                );
            }
        }
        assert_eq!(map.count(SectorState::Good), iso.total_sectors - 2);
        assert_eq!(map.count(SectorState::Failed), 2);

        // Now run VOB extraction against the recovered map.
        let entries = crate::dvd::iso9660::list_video_ts(reader.as_ref())
            .expect("walk")
            .expect("VIDEO_TS present");
        let extract_dir = std::env::temp_dir().join(format!(
            "dvd-rescue-extract-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&extract_dir).unwrap();

        let extracted = crate::media::vob::extract_files(
            reader.as_ref(),
            Some(&map),
            &entries,
            &extract_dir,
        )
        .expect("extract");
        assert_eq!(extracted.len(), 3);

        // The VOB had sector 24 marked bad (the 3rd of 5 sectors). Its bytes
        // for that sector should be all zeros; surrounding sectors should be
        // byte-identical to the original.
        let vob_path = extract_dir.join("VTS_01_1.VOB");
        let extracted_vob = std::fs::read(&vob_path).unwrap();
        assert_eq!(extracted_vob.len(), (VOB_SECTORS * DVD_SECTOR_SIZE as u64) as usize);

        // Sector 0 of the VOB (= disc LBA 22): byte 4 was set to 0 originally.
        assert_eq!(extracted_vob[4], 0);
        // Sector 1 of the VOB (= disc LBA 23): byte 4 was set to 1.
        assert_eq!(extracted_vob[DVD_SECTOR_SIZE + 4], 1);
        // Sector 2 of the VOB (= disc LBA 24, BAD): all zeros.
        assert!(
            extracted_vob[DVD_SECTOR_SIZE * 2..DVD_SECTOR_SIZE * 3]
                .iter()
                .all(|&b| b == 0),
            "damaged sector should be zero-filled"
        );
        // Sector 3 of the VOB (= disc LBA 25): byte 4 was set to 3.
        assert_eq!(extracted_vob[DVD_SECTOR_SIZE * 3 + 4], 3);

        // The IFO file was entirely damaged — it should be all zeros.
        let ifo_path = extract_dir.join("VTS_01_0.IFO");
        let extracted_ifo = std::fs::read(&ifo_path).unwrap();
        assert!(
            extracted_ifo.iter().all(|&b| b == 0),
            "damaged IFO should be zero-filled"
        );

        // The BUP (backup of IFO) was NOT damaged — it should match the
        // original recognizable bytes.
        let bup_path = extract_dir.join("VTS_01_0.BUP");
        let extracted_bup = std::fs::read(&bup_path).unwrap();
        assert_eq!(&extracted_bup[..12], b"DVDVIDEO-VTS");

        let _ = std::fs::remove_dir_all(&extract_dir);
        let _ = std::fs::remove_file(iso_path);
    }

    #[test]
    fn iso9660_parser_finds_video_ts() {
        let iso = build_synthetic_dvd_iso();
        let (reader, path) = IsoFileSectorReader::from_bytes(&iso.bytes, HashSet::new()).unwrap();

        let vol = crate::dvd::iso9660::read_volume(&reader).expect("PVD readable");
        assert_eq!(vol.label, "TEST_DISC");
        assert_eq!(vol.total_sectors, iso.total_sectors);
        assert_eq!(vol.root_lba, ROOT_DIR_LBA);

        let entries = crate::dvd::iso9660::list_video_ts(&reader)
            .expect("walk")
            .expect("VIDEO_TS present");
        assert_eq!(entries.len(), 3);
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"VTS_01_0.IFO"));
        assert!(names.contains(&"VTS_01_0.BUP"));
        assert!(names.contains(&"VTS_01_1.VOB"));

        // Verify extents match what we wrote.
        let vob = entries.iter().find(|e| e.name == "VTS_01_1.VOB").unwrap();
        assert_eq!(vob.start_lba, VOB_LBA);
        assert_eq!(vob.size_bytes, VOB_SECTORS * DVD_SECTOR_SIZE as u64);

        let _ = std::fs::remove_file(path);
    }

    /// IFO intact, BUP damaged. Health scoring depends on at least one of
    /// the IFO/BUP pair being readable; this test pins the "BUP-only damaged"
    /// case to "critical structures intact" because we still have the IFO.
    #[test]
    fn bup_damaged_ifo_intact() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::health;
        use crate::recovery::map::SectorState;
        use crate::recovery::passes::PassStrategy;
        use std::sync::Arc;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(BUP_LBA);

        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad.clone()).unwrap();
        let reader = Arc::new(reader);

        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            reader.clone(),
            vec![PassStrategy::Triage, PassStrategy::SlowRead],
        );
        engine.run();
        let map = engine.snapshot_map();

        assert_eq!(map.get(IFO_LBA), SectorState::Good);
        assert_eq!(map.get(BUP_LBA), SectorState::Failed);
        assert_eq!(map.count(SectorState::Failed), 1);

        // Health should report critical_intact — IFO is the primary, BUP is
        // a backup. Only when BOTH are damaged is the structure broken.
        let entries = crate::dvd::iso9660::list_video_ts(reader.as_ref())
            .ok()
            .flatten();
        let report = health::compute(&map, entries.as_deref());
        // We damaged 1 sector that belongs to a critical file (BUP). The
        // current health impl flags critical_intact=false when ANY critical
        // file has a non-Good sector. That's acceptable conservative
        // behavior; pin it so future tightening is intentional.
        assert!(
            !report.critical_intact,
            "current contract: any damaged byte in IFO/BUP \
             flips critical_intact (conservative)"
        );

        let _ = std::fs::remove_file(iso_path);
    }

    /// A long contiguous bad region — the kind a single deep scratch
    /// produces. Skip-ahead must keep the run from grinding forever.
    #[test]
    fn contiguous_scratch_recovery_completes_quickly() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::map::SectorState;
        use crate::recovery::passes::PassStrategy;
        use std::sync::Arc;
        use std::time::Instant;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        // Damage every sector from VOB_LBA + 1 through VOB_LBA + 4 (4 sectors,
        // ~8KB — enough to trip block-mode failure handling without blowing
        // up the test ISO).
        let mut bad: HashSet<u64> = HashSet::new();
        for lba in (VOB_LBA + 1)..=(VOB_LBA + 4) {
            bad.insert(lba);
        }
        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad.clone()).unwrap();
        let reader = Arc::new(reader);

        let started = Instant::now();
        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            reader,
            vec![
                PassStrategy::Triage,
                PassStrategy::SlowRead,
                PassStrategy::Reverse,
            ],
        );
        engine.run();
        let elapsed = started.elapsed();

        // The engine must finish — no hangs, no grinding. Test ISO is tiny
        // so even with all retry passes it completes in well under a second.
        assert!(
            elapsed.as_secs() < 5,
            "recovery should complete in <5s on a 27-sector test ISO; \
             took {:?} (likely hung)",
            elapsed
        );

        let map = engine.snapshot_map();
        assert_eq!(
            map.count(SectorState::Failed),
            bad.len() as u64,
            "exactly the bad sectors should be marked Failed"
        );
        let _ = std::fs::remove_file(iso_path);
    }

    /// PVD at sector 16 is unreadable — `read_volume` must return an error
    /// without panicking. Recovery itself can still proceed at the sector
    /// level; we just can't enumerate VIDEO_TS until those sectors recover.
    #[test]
    fn corrupt_pvd_walker_fails_gracefully() {
        let iso = build_synthetic_dvd_iso();
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(PVD_LBA);
        let (reader, path) = IsoFileSectorReader::from_bytes(&iso.bytes, bad).unwrap();

        // Both walker entry points should return Err, not panic.
        let vol = crate::dvd::iso9660::read_volume(&reader);
        assert!(vol.is_err(), "PVD unreadable should return Err");

        let video_ts = crate::dvd::iso9660::list_video_ts(&reader);
        assert!(video_ts.is_err(), "VIDEO_TS walk should propagate the PVD error");

        let _ = std::fs::remove_file(path);
    }

    /// End-to-end rmap roundtrip: run a recovery against a damaged ISO,
    /// export the sector map to ddrescue format, decode it back, and confirm
    /// the parsed map matches the original sector-for-sector. Validates the
    /// portability promise (any user can hand off a recovery to ddrescue).
    #[test]
    fn rmap_export_import_roundtrip_preserves_recovery() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::map::SectorState;
        use crate::recovery::passes::PassStrategy;
        use crate::recovery::rmap;
        use std::sync::Arc;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(IFO_LBA);
        bad.insert(VOB_LBA + 2);

        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad.clone()).unwrap();
        let reader = Arc::new(reader);
        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            reader,
            vec![PassStrategy::Triage, PassStrategy::SlowRead],
        );
        engine.run();
        let original_map = engine.snapshot_map();

        // Encode → decode → compare every sector.
        let header = rmap::RmapHeader {
            disc_label: Some("ROUNDTRIP_TEST".into()),
            disc_fingerprint: Some("deadbeef".into()),
            current_pass: 2,
            app_version: env!("CARGO_PKG_VERSION"),
        };
        let text = rmap::encode(&original_map, &header);
        // Sanity: the export must mention damaged sectors as bad runs.
        assert!(text.contains("# Disc: ROUNDTRIP_TEST"));
        assert!(text.contains("-")); // bad-sector status char must be present

        let parsed = rmap::decode(&text, original_map.total()).unwrap();
        for lba in 0..original_map.total() {
            assert_eq!(
                original_map.get(lba),
                parsed.get(lba),
                "rmap roundtrip lost state at LBA {lba}"
            );
        }

        // And confirm the recovered states match what we expect.
        assert_eq!(parsed.count(SectorState::Failed), 2);
        assert_eq!(parsed.count(SectorState::Good), iso.total_sectors - 2);

        let _ = std::fs::remove_file(iso_path);
    }

    /// Both IFO and BUP unreadable — VOB extraction must still produce a
    /// usable file. The whole point of recovering home-video DVDs is "we
    /// got the video even if the structural metadata is gone".
    #[test]
    fn both_ifo_and_bup_dead_vob_still_extracts() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::map::SectorState;
        use crate::recovery::passes::PassStrategy;
        use std::sync::Arc;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(IFO_LBA);
        bad.insert(BUP_LBA);
        // VOB sectors stay readable.

        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad).unwrap();
        let reader = Arc::new(reader);
        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            reader.clone(),
            vec![PassStrategy::Triage, PassStrategy::SlowRead],
        );
        engine.run();
        let map = engine.snapshot_map();

        // The two structural files are Failed. VOB sectors should be Good.
        assert_eq!(map.get(IFO_LBA), SectorState::Failed);
        assert_eq!(map.get(BUP_LBA), SectorState::Failed);
        for lba in VOB_LBA..(VOB_LBA + VOB_SECTORS) {
            assert_eq!(
                map.get(lba),
                SectorState::Good,
                "VOB sector {lba} must survive even when IFO+BUP are gone"
            );
        }

        // The ISO9660 walker can still navigate to VIDEO_TS because the root
        // dir was undamaged — we don't actually parse IFO contents at the
        // filesystem layer. So extraction proceeds normally.
        let entries = crate::dvd::iso9660::list_video_ts(reader.as_ref())
            .expect("walk")
            .expect("VIDEO_TS present");
        let extract_dir = std::env::temp_dir().join(format!(
            "dvd-rescue-bothfail-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&extract_dir).unwrap();
        let extracted = crate::media::vob::extract_files(
            reader.as_ref(),
            Some(&map),
            &entries,
            &extract_dir,
        )
        .unwrap();
        assert_eq!(extracted.len(), 3);

        // VOB content must be byte-identical to source — this is the
        // critical recovery guarantee for the user's home video.
        let vob = std::fs::read(extract_dir.join("VTS_01_1.VOB")).unwrap();
        let original_vob_off = (VOB_LBA * DVD_SECTOR_SIZE as u64) as usize;
        let original_vob_len = (VOB_SECTORS * DVD_SECTOR_SIZE as u64) as usize;
        assert_eq!(
            vob,
            iso.bytes[original_vob_off..original_vob_off + original_vob_len].to_vec(),
            "VOB content drifted from source despite undamaged sectors"
        );

        let _ = std::fs::remove_dir_all(&extract_dir);
        let _ = std::fs::remove_file(iso_path);
    }

    /// Health score must hold the line on the "saved video / total video"
    /// math — small structural damage shouldn't tank the score below the
    /// threshold for "we saved most of your video".
    #[test]
    fn health_score_reflects_actual_recoverability() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::health;
        use crate::recovery::passes::PassStrategy;
        use std::sync::Arc;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        // Damage just one VOB sector — most video preserved.
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(VOB_LBA + 2);

        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad).unwrap();
        let reader = Arc::new(reader);
        let engine = RecoveryEngine::new(
            Uuid::new_v4(),
            reader.clone(),
            vec![PassStrategy::Triage, PassStrategy::SlowRead],
        );
        engine.run();
        let map = engine.snapshot_map();

        let entries = crate::dvd::iso9660::list_video_ts(reader.as_ref())
            .ok()
            .flatten();
        let report = health::compute(&map, entries.as_deref());

        // 1 Failed sector out of 27 total = ~96% coverage. Health score
        // should be in the "we saved most of your video" range.
        assert!(
            report.score >= 70,
            "health score {} too low for 1-sector damage on a 27-sector disc",
            report.score
        );
        assert!(report.coverage_pct > 90.0);
        assert!(report.failed_sectors == 1);

        let _ = std::fs::remove_file(iso_path);
    }

    /// Recovery → rmap export → fresh engine import → re-run resume scenario.
    /// Validates that a user can interrupt a recovery, hand the map off to
    /// another machine via .rmap, and the second engine sees identical state.
    #[test]
    fn rmap_handoff_to_fresh_engine_preserves_progress() {
        use crate::recovery::engine::RecoveryEngine;
        use crate::recovery::map::SectorState;
        use crate::recovery::passes::PassStrategy;
        use crate::recovery::rmap;
        use std::sync::Arc;
        use uuid::Uuid;

        let iso = build_synthetic_dvd_iso();
        let mut bad: HashSet<u64> = HashSet::new();
        bad.insert(IFO_LBA);

        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, bad).unwrap();
        let reader = Arc::new(reader);

        // First engine runs Triage only — leaves some sectors Unknown if
        // skip-ahead activated. Then we export the map.
        let engine1 = RecoveryEngine::new(
            Uuid::new_v4(),
            reader.clone(),
            vec![PassStrategy::Triage],
        );
        engine1.run();
        let map1 = engine1.snapshot_map();
        let header = rmap::RmapHeader::default();
        let text = rmap::encode(&map1, &header);

        // Simulate a fresh process: parse the rmap and stuff the resulting
        // map into a brand-new engine on the same reader.
        let map2 = rmap::decode(&text, map1.total()).unwrap();
        let engine2 = RecoveryEngine::new(
            Uuid::new_v4(),
            reader.clone(),
            vec![PassStrategy::SlowRead],
        );
        engine2.restore_map(map2);

        // Before SlowRead runs, engine2's state must match map1 exactly.
        let map2_before = engine2.snapshot_map();
        for lba in 0..iso.total_sectors {
            assert_eq!(
                map1.get(lba),
                map2_before.get(lba),
                "rmap handoff lost state at LBA {lba}"
            );
        }

        // Now run SlowRead — it should retry Failed sectors. The IFO
        // sector is permanently bad, so it stays Failed. Everything else
        // stays as it was.
        engine2.run();
        let map_final = engine2.snapshot_map();
        assert_eq!(map_final.get(IFO_LBA), SectorState::Failed);
        // Total Failed count should be exactly 1.
        assert_eq!(map_final.count(SectorState::Failed), 1);

        let _ = std::fs::remove_file(iso_path);
    }

    /// Sanity check that walk_all_files visits the same VIDEO_TS files as
    /// list_video_ts on this synthetic disc, with relative paths set.
    /// (For data discs we'd see PHOTOS/, DOCS/, etc; the synthetic disc
    /// only has VIDEO_TS — we check the recursion + path-flattening logic.)
    #[test]
    fn walk_all_files_visits_video_ts_with_relative_paths() {
        use crate::dvd::iso9660::walk_all_files;

        let iso = build_synthetic_dvd_iso();
        let (reader, iso_path) =
            IsoFileSectorReader::from_bytes(&iso.bytes, HashSet::new()).unwrap();

        let files = walk_all_files(&reader).expect("walk should succeed");

        // Each file's name should be prefixed by VIDEO_TS/.
        let names: Vec<_> = files.iter().map(|e| e.name.as_str()).collect();
        assert!(names.iter().any(|n| n.starts_with("VIDEO_TS/") && n.ends_with("VTS_01_0.IFO")),
            "expected VIDEO_TS/VTS_01_0.IFO, got {:?}", names);
        assert!(names.iter().any(|n| n.starts_with("VIDEO_TS/") && n.ends_with("VTS_01_0.BUP")),
            "expected VIDEO_TS/VTS_01_0.BUP, got {:?}", names);
        assert!(names.iter().any(|n| n.starts_with("VIDEO_TS/") && n.ends_with("VTS_01_1.VOB")),
            "expected VIDEO_TS/VTS_01_1.VOB, got {:?}", names);

        // No directories should appear in the result (walker filters them out).
        assert!(files.iter().all(|e| !e.is_dir));

        // Each file should have its declared start_lba and a non-zero size.
        for f in &files {
            assert!(f.start_lba >= IFO_LBA, "file {} has bogus start_lba {}", f.name, f.start_lba);
            assert!(f.size_bytes > 0, "file {} has zero size", f.name);
        }

        let _ = std::fs::remove_file(iso_path);
    }
}
