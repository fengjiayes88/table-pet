"""Match generated action sprites to the canonical idle sprite palette.

The adjustment is deliberately conservative: it remaps warm fur tones and
neutral chest fur independently, while leaving eyes, nose, and alpha untouched.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REFERENCE = ROOT / "assets" / "sprites" / "idle@4.png"


def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    red, green, blue = np.moveaxis(rgb, -1, 0)
    maximum = rgb.max(axis=-1)
    minimum = rgb.min(axis=-1)
    delta = maximum - minimum

    hue = np.zeros_like(maximum)
    active = delta > 1e-6
    red_max = active & (maximum == red)
    green_max = active & (maximum == green)
    blue_max = active & (maximum == blue)
    hue[red_max] = ((green[red_max] - blue[red_max]) / delta[red_max]) % 6
    hue[green_max] = (blue[green_max] - red[green_max]) / delta[green_max] + 2
    hue[blue_max] = (red[blue_max] - green[blue_max]) / delta[blue_max] + 4
    hue /= 6

    saturation = np.zeros_like(maximum)
    non_black = maximum > 1e-6
    saturation[non_black] = delta[non_black] / maximum[non_black]
    return hue, saturation, maximum


def palette_masks(rgba: np.ndarray) -> dict[str, np.ndarray]:
    rgb = rgba[:, :, :3] / 255.0
    hue, saturation, value = rgb_to_hsv(rgb)
    visible = rgba[:, :, 3] > 32
    warm = visible & (hue < 0.14) & (saturation > 0.18)
    return {
        "dark": warm & (value < 0.38),
        "mid": warm & (value > 0.35) & (value < 0.80) & (saturation > 0.22),
        "highlight": warm & (value >= 0.80),
        "light": visible & (saturation < 0.22) & (value > 0.72),
        "warm": warm,
        "value": value,
    }


def median_rgb(rgba: np.ndarray, mask: np.ndarray) -> np.ndarray:
    pixels = rgba[:, :, :3][mask]
    if len(pixels) < 64:
        raise ValueError("not enough pixels to measure a palette band")
    return np.median(pixels.astype(np.float32), axis=0)


def palette(rgba: np.ndarray) -> dict[str, np.ndarray]:
    masks = palette_masks(rgba)
    return {name: median_rgb(rgba, masks[name]) for name in ("dark", "mid", "highlight", "light")}


def match_palette(source: np.ndarray, reference_palette: dict[str, np.ndarray]) -> np.ndarray:
    output = source.astype(np.float32).copy()
    masks = palette_masks(source)
    source_palette = {name: median_rgb(source, masks[name]) for name in reference_palette}

    ratios = {
        name: np.clip(reference_palette[name] / np.maximum(source_palette[name], 1), 0.65, 1.35)
        for name in ("dark", "mid", "highlight", "light")
    }

    warm = masks["warm"]
    values = masks["value"][warm]
    for channel in range(3):
        channel_ratio = np.interp(
            values,
            (0.24, 0.58, 0.86),
            (ratios["dark"][channel], ratios["mid"][channel], ratios["highlight"][channel]),
        )
        output[:, :, channel][warm] *= channel_ratio

    light = masks["light"] & ~warm
    output[:, :, :3][light] *= ratios["light"]
    output[:, :, :3] = np.clip(output[:, :, :3], 0, 255)
    output[source[:, :, 3] == 0] = 0
    return output.astype(np.uint8)


def format_palette(measured: dict[str, np.ndarray]) -> str:
    return ", ".join(
        f"{name}=#{''.join(f'{round(value):02x}' for value in values)}"
        for name, values in measured.items()
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE)
    args = parser.parse_args()

    with Image.open(args.reference) as opened:
        reference = np.asarray(opened.convert("RGBA"))
    with Image.open(args.input) as opened:
        source = np.asarray(opened.convert("RGBA"))

    target = palette(reference)
    matched = match_palette(source, target)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(matched, "RGBA").save(args.output, optimize=True)

    print(f"target: {format_palette(target)}")
    print(f"before: {format_palette(palette(source))}")
    print(f"after:  {format_palette(palette(matched))}")
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
