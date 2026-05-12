# Testing Strategy

Recovery software is unreliable without brutal testing. **Build the test rig first**, before features.

## Synthetic damaged disc generator (build this Day 1)

- Take a known-good ISO. Programmatically corrupt it: random bad sectors, contiguous bad ranges, corrupted IFO, missing BUP, truncated VOBs.
- Generate a corpus of **50+ deterministic test cases**.
- Mount via IMDisk virtual drive — no need to burn physical discs.

## Required test scenarios (must pass before release)

- ✅ Pristine disc → 100% recovery, byte-identical.
- ✅ 50 bad sectors scattered randomly → 100% playable output, marked bad regions.
- ✅ Contiguous 10MB bad region → playable, hole gracefully skipped.
- ✅ Missing IFO, valid BUP → recovers using BUP.
- ✅ Both IFO + BUP corrupt → falls back to signature scan, still finds VOBs.
- ✅ Unfinalized disc (no VIDEO_TS index) → finds and extracts streams.
- ✅ Mid-recovery process kill → restart resumes within 1 second of where it stopped.
- ✅ Mid-recovery USB unplug → graceful, recovery map preserved.
- ✅ Mid-recovery system sleep / hibernate → resumes correctly.
- ✅ Drive lockup simulation → recovers within 30 sec, continues.
- ✅ 2-hour recovery on slow USB drive → no memory leaks, stable RAM.
- ✅ AI restore on 90-min file → no OOM, GPU memory stable.

## Real-world disc library

Buy 20-30 genuinely scratched DVDs from thrift stores / eBay lots ($30 total). Test against IsoBuster, CDRoller, our tool. **Track recovery percentage. This becomes your marketing.**

## Performance regression tests

- Recovery throughput on pristine disc: must stay >X MB/s.
- AI restore frame rate: must stay >Y fps on reference GPU.
- App startup time: <2 seconds, always.
