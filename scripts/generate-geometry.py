"""Regenerate fixed, letter-shaped triangle coordinates for the static Hero SVG."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
font = ImageFont.truetype('/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf', 128)
mask = Image.new('L', (420, 130))
draw = ImageDraw.Draw(mask)
position = 0
for letter in 'BRAIN':
    draw.text((position, 11), letter, font=font, fill=255)
    position += font.getlength(letter) - 6

rng = Random(73)
step = 12
rows = []
for row, y in enumerate(range(6, 118, step)):
    points = []
    for col, x in enumerate(range(-8, 400, step)):
        points.append((round(x + (step / 2 if row % 2 else 0) + rng.uniform(-1.7, 1.7), 1),
                       round(y + rng.uniform(-1.6, 1.6), 1)))
    rows.append(points)

triangles = []
for row in range(len(rows)-1):
    for col in range(len(rows[row])-1):
        a, b = rows[row][col:col+2]
        c, d = rows[row+1][col:col+2]
        for vertices in ((a,b,c),(b,d,c)):
            cx = sum(p[0] for p in vertices)/3
            cy = sum(p[1] for p in vertices)/3
            if 0 <= cx < mask.width and 0 <= cy < mask.height and mask.getpixel((int(cx),int(cy))) > 70:
                triangles.append(' '.join(f'{x:g},{y:g}' for x,y in vertices))

output = here.parent / 'src' / 'brainGeometry.js'
transition_mask = Image.new('L', (560, 130))
ImageDraw.Draw(transition_mask).text((381, 11), 'ST', font=font, fill=255)
transition = []
for row, y in enumerate(range(8, 114, 20)):
    for x in range(378, 540, 20):
        shift = 9 if row % 2 else 0
        a, b, c, d = ((x+shift, y), (x+20+shift, y),
                      (x+shift-3, y+20), (x+17+shift, y+20))
        for vertices in ((a,b,c),(b,d,c)):
            cx = sum(p[0] for p in vertices)//3
            cy = sum(p[1] for p in vertices)//3
            if cx < transition_mask.width and transition_mask.getpixel((cx,cy)) > 70:
                transition.append(' '.join(f'{px},{py}' for px,py in vertices))
output.write_text('// Fixed resting coordinates: fragments occupy the BRAIN glyphs.\n'
                  'export const brainFragments = [\n' +
                  ''.join(f'  {fragment!r},\n' for fragment in triangles) +
                  '];\nexport const transitionFragments = [\n' +
                  ''.join(f'  {fragment!r},\n' for fragment in transition) +
                  '];\n', encoding='utf-8')
print(f'{len(triangles)} BRAIN and {len(transition)} ST fragments → {output}')
