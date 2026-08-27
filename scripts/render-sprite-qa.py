"""Render a contact sheet and per-state GIF previews for the app sprite format."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "sprites"
QA = ROOT / "qa"
PREVIEWS = QA / "previews"

STATES = {
    "idle": (("idle@4.png", 4),),
    "walk": (("walk@4.png", 4), ("walk2@4.png", 4)),
    "jump": (("jump@4.png", 4),),
    "headTilt": (("head-tilt@4.png", 4),),
    "pawReach": (("paw-reach@4.png", 4),),
    "roll": (("roll1@4.png", 4), ("roll2@4.png", 4)),
    "dragged": (("dragged@4.png", 4),),
    "reminder": (("reminder@4.png", 4), ("reminder2@4.png", 4)),
    "sleep": (("sleep@4.png", 4),),
}

FRAME_MS = {
    "idle": 300,
    "walk": 140,
    "jump": 150,
    "headTilt": 300,
    "pawReach": 250,
    "roll": 190,
    "dragged": 160,
    "reminder": 180,
    "sleep": 350,
}


def checker(size: int, square: int = 12) -> Image.Image:
    image = Image.new("RGB", (size, size), "#eceef1")
    draw = ImageDraw.Draw(image)
    for y in range(0, size, square):
        for x in range(0, size, square):
            if (x // square + y // square) % 2:
                draw.rectangle((x, y, x + square - 1, y + square - 1), fill="#c7ccd3")
    return image


def frames_for(spec: tuple[tuple[str, int], ...]) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for file_name, count in spec:
        strip = Image.open(SPRITES / file_name).convert("RGBA")
        width = strip.width // count
        frames.extend(strip.crop((index * width, 0, (index + 1) * width, strip.height)) for index in range(count))
    return frames


def composite(frame: Image.Image, size: int) -> Image.Image:
    base = checker(size)
    sprite = frame.copy()
    sprite.thumbnail((size, size), Image.Resampling.LANCZOS)
    base.paste(sprite, ((size - sprite.width) // 2, (size - sprite.height) // 2), sprite)
    return base


def main() -> None:
    QA.mkdir(exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    cell = 170
    label_width = 120
    max_frames = max(sum(count for _, count in spec) for spec in STATES.values())
    sheet = Image.new("RGB", (label_width + max_frames * cell, len(STATES) * cell), "#252932")
    draw = ImageDraw.Draw(sheet)

    for row, (state, spec) in enumerate(STATES.items()):
        frames = frames_for(spec)
        draw.text((12, row * cell + 14), state, fill="white")
        draw.text((12, row * cell + 38), f"{len(frames)} frames", fill="#aab1bd")
        previews = []
        for index, frame in enumerate(frames):
            preview = composite(frame, cell - 8)
            x = label_width + index * cell + 4
            y = row * cell + 4
            sheet.paste(preview, (x, y))
            draw.text((x + 5, y + 4), str(index), fill="#20232a")
            previews.append(composite(frame, 220))
        previews[0].save(
            PREVIEWS / f"{state}.gif",
            save_all=True,
            append_images=previews[1:],
            duration=FRAME_MS[state],
            loop=0,
            disposal=2,
        )

    sheet.save(QA / "contact-sheet.png", optimize=True)
    print(QA / "contact-sheet.png")


if __name__ == "__main__":
    main()
