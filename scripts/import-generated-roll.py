"""Turn a generated 4x2 roll grid into the two runtime sprite strips."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "sprites"
FRAME_SIZE = 512
PADDING = 28


def remove_checkerboard(cell: Image.Image) -> Image.Image:
    rgb = np.asarray(cell.convert("RGB")).copy()
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    background_candidate = (low >= 232) & ((high - low) <= 14)

    seeds = np.zeros(background_candidate.shape, dtype=bool)
    seeds[[0, -1], :] = background_candidate[[0, -1], :]
    seeds[:, [0, -1]] = background_candidate[:, [0, -1]]
    exterior = ndimage.binary_propagation(seeds, mask=background_candidate)

    foreground = ~exterior
    labels, count = ndimage.label(foreground, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        raise ValueError("generated cell contains no foreground")
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    subject = labels == int(np.argmax(areas))
    subject = ndimage.binary_fill_holes(subject)

    alpha = ndimage.gaussian_filter(subject.astype(np.float32), sigma=0.55)
    alpha = np.clip((alpha - 0.08) / 0.84, 0, 1)
    rgba = np.dstack((rgb, np.rint(alpha * 255).astype(np.uint8)))
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def keep_main_alpha_component(cell: Image.Image) -> Image.Image:
    rgba = np.asarray(cell.convert("RGBA")).copy()
    foreground = rgba[:, :, 3] > 8
    labels, count = ndimage.label(foreground, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        raise ValueError("generated cell contains no foreground")
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    subject = labels == int(np.argmax(areas))
    keep = ndimage.binary_dilation(subject, iterations=2) & (rgba[:, :, 3] > 0)
    rgba[~keep] = 0
    rgba[rgba[:, :, 3] == 0] = 0
    return Image.fromarray(rgba, "RGBA")


def normalize(frames: list[Image.Image]) -> list[Image.Image]:
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    if any(box is None for box in boxes):
        raise ValueError("empty roll frame after background removal")
    widths = [box[2] - box[0] for box in boxes if box]
    heights = [box[3] - box[1] for box in boxes if box]
    scale = min((FRAME_SIZE - 2 * PADDING) / max(widths), (FRAME_SIZE - 2 * PADDING) / max(heights))

    result = []
    for frame, box in zip(frames, boxes, strict=True):
        crop = frame.crop(box)
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        resized = crop.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        x = (FRAME_SIZE - resized.width) // 2
        y = FRAME_SIZE - PADDING - resized.height
        canvas.alpha_composite(resized, (x, y))
        pixels = np.asarray(canvas).copy()
        pixels[pixels[:, :, 3] == 0] = 0
        result.append(Image.fromarray(pixels, "RGBA"))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    with Image.open(args.source) as opened:
        has_transparency = "A" in opened.getbands() and opened.getchannel("A").getextrema()[0] == 0
        grid = opened.convert("RGBA" if has_transparency else "RGB")

    x_bounds = [round(index * grid.width / 4) for index in range(5)]
    y_bounds = [round(index * grid.height / 2) for index in range(3)]
    frames = []
    for row in range(2):
        for column in range(4):
            cell = grid.crop((x_bounds[column], y_bounds[row], x_bounds[column + 1], y_bounds[row + 1]))
            frames.append(keep_main_alpha_component(cell) if has_transparency else remove_checkerboard(cell))
    frames = normalize(frames)

    for strip_index, file_name in enumerate(("roll1@4.png", "roll2@4.png")):
        strip = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE), (0, 0, 0, 0))
        for index, frame in enumerate(frames[strip_index * 4:(strip_index + 1) * 4]):
            strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
        temporary = SPRITES / f".{file_name}.generated.tmp.png"
        strip.save(temporary, optimize=True)
        temporary.replace(SPRITES / file_name)
        print(f"wrote {file_name}")


if __name__ == "__main__":
    main()
