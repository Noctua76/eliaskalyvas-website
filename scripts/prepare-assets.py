"""Copy the approved uploads into stable public paths without changing card pixels."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
uploads = root / 'upload'
out = root / 'eliaskalyvas-website' / 'public' / 'assets'
(out / 'brand').mkdir(parents=True, exist_ok=True)
(out / 'cards').mkdir(parents=True, exist_ok=True)

logo = Image.open(uploads / 'Εικόνα ChatGPT 27 Σεπ 2026, 09_14_27 π.μ..png').convert('RGBA')
# The approved mark has generous transparent canvas. Cropping affects no visible pixels.
alpha = logo.getchannel('A')
bounds = alpha.point(lambda v: 255 if v > 10 else 0).getbbox()
padding = 12
crop = (max(0, bounds[0]-padding), max(0, bounds[1]-padding),
        min(logo.width, bounds[2]+padding), min(logo.height, bounds[3]+padding))
logo.crop(crop).save(out / 'brand' / 'ek-mark.png')

mapping = {
    '09_14_17 π.μ.-6': 'card-01-people-growth.png',
    '09_14_11 π.μ.-2': 'card-02-business-growth.png',
    '09_14_08 π.μ.-1': 'card-03-ai-systems.png',
    '09_14_13 π.μ.-3': 'card-04-my-mentor.png',
    '09_14_14 π.μ.-4': 'card-05-thinking-intelligence.png',
    '09_14_16 π.μ.-5': 'card-06-platform-architecture.png',
}
for suffix, name in mapping.items():
    source = next(uploads.glob(f'*{suffix}.png'))
    (out / 'cards' / name).write_bytes(source.read_bytes())
