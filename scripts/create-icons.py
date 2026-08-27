"""Build Windows icon assets from the canonical transparent pet artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "references" / "qixi-canonical.png"
PNG_OUTPUT = ROOT / "assets" / "app-icon.png"
ICO_OUTPUT = ROOT / "assets" / "icon.ico"


def main() -> None:
    with Image.open(SOURCE) as source_image:
        source = source_image.convert("RGBA")

    alpha_box = source.getchannel("A").getbbox()
    if not alpha_box:
        raise RuntimeError(f"No visible pixels in {SOURCE}")

    pet = source.crop(alpha_box)
    max_side = 448
    pet.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    x = (canvas.width - pet.width) // 2
    y = (canvas.height - pet.height) // 2
    canvas.alpha_composite(pet, (x, y))
    canvas.save(PNG_OUTPUT, optimize=True)
    canvas.save(
        ICO_OUTPUT,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"Created {ICO_OUTPUT} from {SOURCE}")


if __name__ == "__main__":
    main()
