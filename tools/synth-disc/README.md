# synth-disc

Standalone CLI that takes a clean DVD-Video ISO and produces a deterministically
corrupted copy plus a JSON manifest describing every corruption applied. Used
to feed the DVD-Recovery engine reproducible test fixtures.

This crate is intentionally **not** a workspace member of the main app — it has
no dependency on any code under `src-tauri/`.

## Build

```bash
export PATH="$PATH:/c/Users/Lenovo/.cargo/bin"   # MSVC linker is already on PATH
cd tools/synth-disc
cargo build
```

## Output layout

Every invocation writes three files into `--output`:

- `corrupted.iso` — the damaged image
- `manifest.json` — machine-readable record of every corruption
- `summary.txt`   — human-readable summary

## Examples

```bash
# 50 random unreadable sectors, deterministic via --seed
./target/debug/synth-disc.exe random-bad-sectors \
    --input clean.iso --output ./corrupt-test --count 50 --seed 42

# Single big "scratch" — 200 contiguous bad sectors starting at LBA 5000
./target/debug/synth-disc.exe contiguous-range \
    --input clean.iso --output ./scratch --start 5000 --length 200

# Zero every .IFO file (forces BUP fallback in the recovery path)
./target/debug/synth-disc.exe corrupt-ifo --input clean.iso --output ./no-ifo

# Zero every .BUP file
./target/debug/synth-disc.exe missing-bup --input clean.iso --output ./no-bup

# Truncate the largest VOB by 1 MiB
./target/debug/synth-disc.exe truncate-vobs \
    --input clean.iso --output ./short --bytes 1048576

# Wipe the CD001 magic in the PVD (simulates an unfinalised disc)
./target/debug/synth-disc.exe unfinalized --input clean.iso --output ./unfinal

# Apply multiple corruptions from a TOML config
./target/debug/synth-disc.exe multi \
    --input clean.iso --output ./combo --config combo.toml
```

### `multi` config format

```toml
[random_bad_sectors]
count = 100
seed  = 42

[contiguous_range]
start  = 5000
length = 50

corrupt_ifo  = true
missing_bup  = false
unfinalized  = false

[truncate_vobs]
bytes = 65536
```

## Manifest schema

`manifest.json` contains:

```jsonc
{
  "source_iso": "clean.iso",
  "output_iso": "./corrupt-test/corrupted.iso",
  "source_size_bytes": 4707319808,
  "output_size_bytes": 4707319808,
  "seed": 42,
  "mode": "random-bad-sectors",
  "records": [
    { "kind": "zeroed_sectors", "start_lba": 1234, "length": 1, "reason": "..." },
    { "kind": "zeroed_file",    "path": "/VIDEO_TS/VTS_01_0.IFO", "start_lba": 312, "length_sectors": 8, "size_bytes": 16384 },
    { "kind": "truncated_file", "path": "/VIDEO_TS/VTS_01_2.VOB", "bytes_removed": 1048576, "new_size": 1072693248 },
    { "kind": "invalidated_volume_descriptor", "sector": 16 },
    { "kind": "truncated_image", "bytes_removed": 1048576, "new_size": 4706271232 }
  ]
}
```

## Tests

```bash
cargo test
```

Covers manifest JSON round-trip, tagged enum serialization, and the
random-bad-sector LBA distribution (distinct, sorted, deterministic by seed,
system-area skip).
