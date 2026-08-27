"""Create a layout-only four-cell guide for image generation grounding."""

from pathlib import Path

from PIL import Image, ImageDraw


root = Path(__file__).resolve().parents[1]
output = root / "assets" / "references" / "layout-guides" / "four-frame-strip.png"
output.parent.mkdir(parents=True, exist_ok=True)

cell = 512
image = Image.new("RGB", (cell * 4, cell), "#00ff00")
draw = ImageDraw.Draw(image)
for index in range(4):
    left = index * cell
    draw.rectangle((left + 24, 24, left + cell - 25, cell - 25), outline="#007f7f", width=3)
    draw.line((left + cell // 2, 24, left + cell // 2, cell - 25), fill="#007f7f", width=2)
    draw.line((left + 24, cell // 2, left + cell - 25, cell // 2), fill="#007f7f", width=2)
    draw.text((left + 38, 36), f"FRAME {index + 1}", fill="#003f3f")
image.save(output, optimize=True)
print(output)
