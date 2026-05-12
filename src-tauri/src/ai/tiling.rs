//! Tile-based image dispatch for AI inference.
//!
//! Real-ESRGAN and friends can't process a 1920×1080 frame whole on a 6GB
//! GPU — VRAM blows up quadratically with tile size. Standard practice is
//! to split the image into a grid of overlapping tiles, run inference per
//! tile, then stitch the outputs back. The overlap is later cropped away
//! to hide tile boundaries (which often have small inference artifacts).
//!
//! ## Layout
//!
//! ```text
//!  ┌──────────────────────────────────┐
//!  │ tile 0 │ tile 1 │ tile 2 │ tile 3│
//!  ├────────┼────────┼────────┼───────┤
//!  │ tile 4 │ tile 5 │ tile 6 │ tile 7│
//!  └──────────────────────────────────┘
//! ```
//!
//! For now we use **non-overlapping** tiles. Adding overlap is a focused
//! quality improvement that doesn't change the public API.

use crate::ai::backend::{AiBackend, BackendResult, Tile};
use crate::ai::models::AiModel;

/// Bytes per pixel for an RGB tile. Matches `TileLayout::Rgb`.
const RGB_BYTES_PER_PX: usize = 3;

/// An RGB image laid out as a flat byte vec, row-major.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RgbImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

impl RgbImage {
    pub fn new(width: u32, height: u32, data: Vec<u8>) -> Self {
        debug_assert_eq!(
            data.len(),
            width as usize * height as usize * RGB_BYTES_PER_PX
        );
        Self { width, height, data }
    }

    pub fn black(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            data: vec![0u8; width as usize * height as usize * RGB_BYTES_PER_PX],
        }
    }
}

/// Split an image into a row-major grid of tiles, each at most `max_tile`
/// wide and tall. Tiles on the right + bottom edge may be smaller.
pub fn split_into_tiles(img: &RgbImage, max_tile: u32) -> Vec<Tile> {
    debug_assert!(max_tile > 0);
    let mut tiles = Vec::new();
    let stride = img.width as usize * RGB_BYTES_PER_PX;
    let mut y = 0u32;
    while y < img.height {
        let th = (img.height - y).min(max_tile);
        let mut x = 0u32;
        while x < img.width {
            let tw = (img.width - x).min(max_tile);
            // Copy this rectangle out of the source image.
            let mut data = Vec::with_capacity(tw as usize * th as usize * RGB_BYTES_PER_PX);
            for row in 0..th {
                let src_y = (y + row) as usize;
                let src_x_byte = x as usize * RGB_BYTES_PER_PX;
                let row_end = src_x_byte + tw as usize * RGB_BYTES_PER_PX;
                let src_off = src_y * stride;
                data.extend_from_slice(&img.data[src_off + src_x_byte..src_off + row_end]);
            }
            tiles.push(Tile {
                width: tw,
                height: th,
                data,
            });
            x += tw;
        }
        y += th;
    }
    tiles
}

/// Stitch a row-major grid of tiles back into a single image. Validates
/// the tiles share a consistent upscale factor relative to `expected_input`
/// so we know what the output canvas size should be.
///
/// Returns `Err` if the tiles don't tile cleanly into the expected output.
pub fn stitch_tiles(
    tiles: &[Tile],
    expected_input_width: u32,
    expected_input_height: u32,
    max_input_tile: u32,
) -> Result<RgbImage, &'static str> {
    if tiles.is_empty() {
        return Err("no tiles to stitch");
    }

    // Re-derive the original grid layout from the input dimensions, then
    // validate every tile against it.
    let cols = expected_input_width.div_ceil(max_input_tile);
    let rows = expected_input_height.div_ceil(max_input_tile);
    if tiles.len() != (cols * rows) as usize {
        return Err("tile count doesn't match expected grid");
    }

    // Output dimensions = sum of widths in row 0, sum of heights in column 0.
    let row0_width: u32 = (0..cols).map(|c| tiles[c as usize].width).sum();
    let col0_height: u32 = (0..rows).map(|r| tiles[(r * cols) as usize].height).sum();

    let mut out = vec![0u8; row0_width as usize * col0_height as usize * RGB_BYTES_PER_PX];
    let out_stride = row0_width as usize * RGB_BYTES_PER_PX;

    let mut dst_y = 0u32;
    for r in 0..rows {
        let row_height = tiles[(r * cols) as usize].height;
        let mut dst_x = 0u32;
        for c in 0..cols {
            let t = &tiles[(r * cols + c) as usize];
            // Each row in this tile is t.width pixels wide.
            for row in 0..t.height {
                let src_off = row as usize * t.width as usize * RGB_BYTES_PER_PX;
                let dst_off = (dst_y + row) as usize * out_stride
                    + dst_x as usize * RGB_BYTES_PER_PX;
                let row_bytes = t.width as usize * RGB_BYTES_PER_PX;
                out[dst_off..dst_off + row_bytes]
                    .copy_from_slice(&t.data[src_off..src_off + row_bytes]);
            }
            dst_x += t.width;
        }
        dst_y += row_height;
    }
    Ok(RgbImage::new(row0_width, col0_height, out))
}

/// Convenience: split → dispatch through backend → stitch. The most common
/// real-world entry point. Returns the enhanced image.
pub fn process_image(
    img: &RgbImage,
    backend: &dyn AiBackend,
    model: AiModel,
) -> BackendResult<RgbImage> {
    let max_tile = backend.info().max_tile_size;
    let tiles = split_into_tiles(img, max_tile);
    let mut out_tiles = Vec::with_capacity(tiles.len());
    for tile in &tiles {
        out_tiles.push(backend.run(model, tile)?);
    }
    stitch_tiles(&out_tiles, img.width, img.height, max_tile)
        .map_err(|e| crate::ai::backend::BackendError::Inference(e.into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::mock_backend::MockAiBackend;

    fn checker_image(w: u32, h: u32) -> RgbImage {
        let mut data = Vec::with_capacity(w as usize * h as usize * 3);
        for y in 0..h {
            for x in 0..w {
                let v = ((x + y) % 256) as u8;
                data.extend_from_slice(&[v, v.wrapping_add(64), v.wrapping_add(128)]);
            }
        }
        RgbImage::new(w, h, data)
    }

    #[test]
    fn split_then_stitch_roundtrip() {
        // Image not evenly divisible by tile size — the right + bottom
        // edges produce smaller tiles.
        let src = checker_image(150, 90);
        let tiles = split_into_tiles(&src, 64);
        // Grid: ceil(150/64)=3 cols, ceil(90/64)=2 rows = 6 tiles.
        assert_eq!(tiles.len(), 6);
        // Top-left tile is 64×64.
        assert_eq!((tiles[0].width, tiles[0].height), (64, 64));
        // Top-right tile is 22×64 (150 - 128).
        assert_eq!((tiles[2].width, tiles[2].height), (22, 64));
        // Bottom-left is 64×26.
        assert_eq!((tiles[3].width, tiles[3].height), (64, 26));

        let stitched = stitch_tiles(&tiles, 150, 90, 64).unwrap();
        assert_eq!(stitched, src, "round-trip changed pixel data");
    }

    #[test]
    fn split_with_tile_size_larger_than_image() {
        let src = checker_image(40, 30);
        let tiles = split_into_tiles(&src, 64);
        assert_eq!(tiles.len(), 1);
        assert_eq!((tiles[0].width, tiles[0].height), (40, 30));
        let stitched = stitch_tiles(&tiles, 40, 30, 64).unwrap();
        assert_eq!(stitched, src);
    }

    #[test]
    fn stitch_rejects_wrong_tile_count() {
        let src = checker_image(100, 100);
        let mut tiles = split_into_tiles(&src, 64);
        tiles.pop();
        let err = stitch_tiles(&tiles, 100, 100, 64).unwrap_err();
        assert!(err.contains("tile count"));
    }

    #[test]
    fn process_image_pipes_through_backend() {
        // Mock backend with x2 upscale — output should be 2× the input dims.
        let backend = MockAiBackend::new();
        backend
            .load_model(AiModel::RealEsrganX2, std::path::Path::new("/dev/null"))
            .unwrap();
        let src = checker_image(100, 50);
        let out = process_image(&src, &backend, AiModel::RealEsrganX2).unwrap();
        assert_eq!(out.width, 200);
        assert_eq!(out.height, 100);
        // Mock pixel-doubles, so out[0..3] should match src[0..3] (top-left
        // pixel of original tile).
        assert_eq!(&out.data[0..3], &src.data[0..3]);
    }

    #[test]
    fn process_image_passthrough_for_audio_model() {
        // DeepFilterNet is an audio model — mock returns input unchanged.
        let backend = MockAiBackend::new();
        backend
            .load_model(AiModel::DeepFilterNet, std::path::Path::new("/dev/null"))
            .unwrap();
        let src = checker_image(50, 30);
        let out = process_image(&src, &backend, AiModel::DeepFilterNet).unwrap();
        assert_eq!(out, src);
    }
}
