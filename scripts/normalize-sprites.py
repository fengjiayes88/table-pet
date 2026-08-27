"""Normalize existing Qixi sprite strips into clean 512px cells.

This script only performs deterministic cleanup on existing art: frame extraction,
largest-component cleanup, consistent per-state scaling, alignment, and transparent
RGB normalization. It does not invent or duplicate animation poses.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SPRITE_DIR = ROOT / "assets" / "sprites"
TARGET = 512
PADDING = 28


@dataclass(frozen=True)
class StateSpec:
    files: tuple[tuple[str, int], ...]
    vertical_offsets: tuple[int, ...] = ()
    anchor: str = "ground"


SPECS = {
    "idle": StateSpec((("idle@4.png", 4),)),
    "walk": StateSpec((("walk@4.png", 4), ("walk2@4.png", 4))),
    "jump": StateSpec((("jump@4.png", 4),), (0, -50, -80, 0)),
    "headTilt": StateSpec((("head-tilt@4.png", 4),)),
    "pawReach": StateSpec((("paw-reach@4.png", 4),)),
    "roll": StateSpec((("roll1@4.png", 4), ("roll2@4.png", 4))),
    "dragged": StateSpec((("dragged@4.png", 4),), anchor="top"),
    "reminder": StateSpec((("reminder@4.png", 4), ("reminder2@4.png", 4))),
    "sleep": StateSpec((("sleep@4.png", 4),)),
}


def main_component(frame: Image.Image) -> Image.Image:
    rgba = np.asarray(frame.convert("RGBA")).copy()
    foreground = rgba[:, :, 3] > 12
    labels, count = ndimage.label(foreground, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        return Image.new("RGBA", frame.size)
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    label = int(np.argmax(areas))
    core = labels == label
    keep = ndimage.binary_dilation(core, iterations=2) & (rgba[:, :, 3] > 0)
    rgba[~keep] = 0
    return Image.fromarray(rgba, "RGBA")


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("empty sprite frame")
    return bbox


def normalize_state(state: str, spec: StateSpec) -> list[Image.Image]:
    frames: list[Image.Image] = []
    file_slices: list[tuple[int, int]] = []
    cursor = 0
    for file_name, frame_count in spec.files:
        with Image.open(SPRITE_DIR / file_name) as opened:
            source = opened.convert("RGBA")
        bounds = [round(index * source.width / frame_count) for index in range(frame_count + 1)]
        for index in range(frame_count):
            raw = source.crop((bounds[index], 0, bounds[index + 1], source.height))
            frames.append(main_component(raw))
        file_slices.append((cursor, cursor + frame_count))
        cursor += frame_count

    boxes = [alpha_bbox(frame) for frame in frames]
    max_width = max(box[2] - box[0] for box in boxes)
    max_height = max(box[3] - box[1] for box in boxes)
    offsets = spec.vertical_offsets or (0,) * len(frames)
    vertical_motion = max(0, -min(offsets))
    available_height = TARGET - 2 * PADDING - vertical_motion
    scale = min((TARGET - 2 * PADDING) / max_width, available_height / max_height)

    normalized: list[Image.Image] = []
    for frame, box, offset_y in zip(frames, boxes, offsets, strict=True):
        crop = frame.crop(box)
        width = max(1, round(crop.width * scale))
        height = max(1, round(crop.height * scale))
        resized = crop.resize((width, height), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
        x = round((TARGET - width) / 2)
        if spec.anchor == "top":
            y = PADDING
        else:
            y = TARGET - PADDING - height + offset_y
        y = max(PADDING, min(TARGET - PADDING - height, y))
        canvas.alpha_composite(resized, (x, y))

        pixels = np.asarray(canvas).copy()
        pixels[pixels[:, :, 3] == 0] = 0
        normalized.append(Image.fromarray(pixels, "RGBA"))

    for (file_name, _), (start, end) in zip(spec.files, file_slices, strict=True):
        strip = Image.new("RGBA", (TARGET * (end - start), TARGET), (0, 0, 0, 0))
        for index, frame in enumerate(normalized[start:end]):
            strip.alpha_composite(frame, (index * TARGET, 0))
        temporary = SPRITE_DIR / f".{file_name}.tmp.png"
        strip.save(temporary, optimize=True)
        temporary.replace(SPRITE_DIR / file_name)

    return normalized


def main() -> None:
    canonical = None
    for state, spec in SPECS.items():
        frames = normalize_state(state, spec)
        if state == "idle":
            canonical = frames[0]
        print(f"normalized {state}: {len(frames)} frames")

    if canonical is not None:
        reference_dir = ROOT / "assets" / "references"
        reference_dir.mkdir(parents=True, exist_ok=True)
        canonical.save(reference_dir / "qixi-canonical.png", optimize=True)


if __name__ == "__main__":
    main()
