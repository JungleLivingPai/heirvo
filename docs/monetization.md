# Monetization

## Pricing

| Tier | Price | What's included |
|---|---|---|
| **Free trial** | $0 | Full recovery, watch result in-app, but **save to disk is locked**. Removes the IsoBuster trap of "pay $30 to find out if it works." User KNOWS it works before paying. |
| **DVD Rescue** | $69 one-time | Recovery + Stage 1 output. Lifetime updates. |
| **DVD Rescue + AI** | $129 one-time | Adds AI restoration. |
| **Studio license** | $299 | 5 machines, commercial use (transfer services, archivists). |

## Why this pricing wins

- IsoBuster $69 → match for credibility.
- Topaz $299/yr → undercut massively with one-time AI tier.
- The free trial showing the actual video addresses the #1 complaint in forum threads.

## Distribution

- Direct download from your site. Stripe + Paddle for global tax handling.
- **Avoid Microsoft Store v1** (revenue cut, slow approval, restricts raw device access).

## Marketing wedge

- Real recovery comparisons on YouTube vs IsoBuster/CDRoller using your test disc library.
- SEO: *"recover scratched DVD home video"*, *"wedding DVD won't play"*, *"unfinalized DVD recovery"*. This intent traffic converts.
- Reddit: r/DataHoarder, r/datarecovery — be helpful, not promotional.

## MVP scope

### v1.0 — Recovery only ($69)
1. Detect optical drive + disc.
2. Multi-pass sector recovery with persistent map.
3. VOB extraction + signature-based fallback.
4. FFmpeg stream-copy to MP4.
5. The four-screen UX.
6. Resume after crash.

### v1.1 — AI restoration ($129 tier)
7. Real-ESRGAN 2x upscale.
8. Deinterlace + denoise.
9. Three presets (Light/Standard/Maximum).
10. Before/after preview.

### v1.2 — Long-tail polish
11. Multi-drive recovery (try in different drives, merge maps).
12. Audio loudness normalization.
13. Diagnostic export.

**Anything beyond this is v2. Ship v1 in 3-4 months, not 12.**

## Five things that determine success

1. **The recovery engine genuinely outperforms IsoBuster on real damaged discs.** Without this, nothing else matters. Buy 30 scratched discs and benchmark obsessively.
2. **The four-screen UX is so simple a 70-year-old can use it.** Test with actual non-technical users before launch.
3. **Resumability is bulletproof.** Pull the disc, kill the process, reboot — it must always recover gracefully. This is your #1 testimonial driver.
4. **AI restoration is conservative by default.** Win by NOT producing the waxy Topaz look. *"It looks like the original, just clearer"* is the review you want.
5. **The trial lets users SEE recovered video before paying.** This single thing breaks the IsoBuster pricing trust problem and will dominate your conversion rate.
