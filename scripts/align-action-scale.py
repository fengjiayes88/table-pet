"""Align action-sprite visual mass with the canonical idle animation."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "sprites"
FRAME_SIZE = 512
BASELINE = 484
EDGE_MARGIN = 12
MAX_SCALE = 1.15


def frames(path: Path, count: int = 4) -> list[Image.Image]:
    with Image.open(path) as opened:
        strip = opened.convert("RGBA")
    width = strip.width // count
    return [strip.crop((index * width, 0, (index + 1) * width, strip.height)) for index in range(count)]


def visible_area(frame: Image.Image) -> int:
    return int(np.count_nonzero(np.asarray(frame.getchannel("A")) > 32))


def scale_frame(frame: Image.Image, factor: float) -> Image.Image:
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        return frame
    crop = frame.crop(bbox)
    width = max(1, round(crop.width * factor))
    height = max(1, round(crop.height * factor))
    resized = crop.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = round((FRAME_SIZE - width) / 2)
    y = BASELINE - height
    canvas.alpha_composite(resized, (x, y))
    pixels = np.asarray(canvas).copy()
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels, "RGBA")


def align_strip(file_name: str, target_area: float) -> None:
    path = SPRITES / file_name
    source_frames = frames(path)
    boxes = [frame.getchannel("A").getbbox() for frame in source_frames]
    if any(box is None for box in boxes):
        raise ValueError(f"{file_name} contains an empty frame")
    median_area = float(np.median([visible_area(frame) for frame in source_frames]))
    desired = min(MAX_SCALE, max(1 / MAX_SCALE, (target_area / median_area) ** 0.5))
    max_width = max(box[2] - box[0] for box in boxes if box)
    max_height = max(box[3] - box[1] for box in boxes if box)
    fit_scale = min(
        (FRAME_SIZE - EDGE_MARGIN * 2) / max_width,
        (BASELINE - EDGE_MARGIN) / max_height,
    )
    factor = min(desired, fit_scale)
    aligned = [scale_frame(frame, factor) for frame in source_frames]

    strip = Image.new("RGBA", (FRAME_SIZE * len(aligned), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(aligned):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    temporary = path.with_name(f'.{path.name}.aligned.tmp.png')
    strip.save(temporary, optimize=True)
    temporary.replace(path)
    result_area = float(np.median([visible_area(frame) for frame in aligned]))
    print(f"{file_name}: scale={factor:.3f}, median area={median_area:.0f}->{result_area:.0f}")


def main() -> None:
    idle_frames = frames(SPRITES / "idle@4.png")
    target_area = float(np.median([visible_area(frame) for frame in idle_frames]))
    print(f"idle target median area={target_area:.0f}")
    for file_name in (
        "walk@4.png",
        "walk2@4.png",
        "roll1@4.png",
        "roll2@4.png",
        "dragged@4.png",
    ):
        align_strip(file_name, target_area)


if __name__ == "__main__":
    main()
