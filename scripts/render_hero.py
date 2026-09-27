"""Render the cinematic BRAINSTORM hero plates. Requires Pillow, NumPy and SciPy.

The title geometry is composited into every frame. The portrait and interface remain
separate site layers so the approved face, copy and navigation stay untouched.
"""

from pathlib import Path
import argparse
import math
import random
import subprocess

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from scipy.spatial import Delaunay


W, H = 1536, 540
FPS = 24
OUT = Path(__file__).resolve().parents[1] / "public/assets/hero"
FONT = "/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf"
RNG = random.Random(10823)
FONT_SIZE = 125
TOP = 122
START_X = 223
AMBIENT_SECONDS = 8
FIELD_LEFT = -210
FIELD_SPAN = 1290


def clamp(v, lo=0, hi=1):
    return max(lo, min(hi, v))


def smooth(v):
    v = clamp(v)
    return v * v * (3 - 2 * v)


font = ImageFont.truetype(FONT, FONT_SIZE)
brain_width = round(ImageDraw.Draw(Image.new("L", (1, 1))).textlength("BRAIN", font=font))
storm_x = START_X + brain_width - 8

brain_mask = Image.new("L", (W, H))
mask_draw = ImageDraw.Draw(brain_mask)
mask_draw.text((START_X, TOP), "BRAIN", font=font, fill=255, stroke_width=0)
brain_pixels = np.asarray(brain_mask)
storm_mask = Image.new("L", (W, H))
ImageDraw.Draw(storm_mask).text((storm_x, TOP), "STORM", font=font, fill=255)


def make_facets():
    points = []
    for yy in range(TOP - 4, TOP + 142, 8):
        for xx in range(START_X - 5, storm_x + 14, 8):
            points.append((xx + RNG.uniform(-3.2, 3.2), yy + RNG.uniform(-3.2, 3.2)))
    mesh = Delaunay(np.asarray(points))
    facets = []
    for ids in mesh.simplices:
        poly = [points[int(i)] for i in ids]
        centroid = (sum(p[0] for p in poly)/3, sum(p[1] for p in poly)/3)
        cx, cy = map(round, centroid)
        # Keep facets that touch a glyph edge, including the cap line. Testing
        # only the centroid left the upper edge of BRAIN visibly incomplete.
        samples = [centroid, *poly]
        if not any(0 <= round(px) < W and 0 <= round(py) < H and
                   brain_pixels[round(py), round(px)] for px, py in samples):
            continue
        facets.append({
            "poly": poly, "cx": centroid[0], "cy": centroid[1],
            "sx": RNG.uniform(-130, 470), "sy": RNG.uniform(22, 460),
            "depth": RNG.uniform(.10, 1.0), "rot": RNG.uniform(-3.2, 3.2),
            "delay": RNG.uniform(.0, 1.65) + (centroid[0] - START_X) / brain_width * .57,
            "shade": RNG.choice(((224, 240, 253), (247, 249, 252), (164, 198, 225), (124, 170, 209), (232, 242, 250))),
        })
    return facets


FACETS = make_facets()
FIELD = [
    (RNG.uniform(-140, 710), RNG.uniform(5, 490), RNG.uniform(.12, 1), RNG.uniform(.2, 1), RNG.uniform(0, 6.28))
    for _ in range(154)
]
SHARDS = [
    (RNG.uniform(-60, 450), RNG.uniform(62, 455), RNG.uniform(.2, 1),
     RNG.uniform(9, 29), RNG.uniform(-3, 3), RNG.uniform(0, math.tau))
    for _ in range(27)
]
LINES = []
for i, (x, y, z, _, _) in enumerate(FIELD):
    candidates = sorted(((math.hypot(x-x2, y-y2), j) for j, (x2, y2, *_)
                         in enumerate(FIELD) if j != i))[:2]
    LINES.extend((i, j) for distance, j in candidates if distance < 116 and j > i)


def backdrop(t):
    y, x = np.mgrid[0:H, 0:W]
    halo = np.exp(-(((x-972)/440)**2 + ((y-205)/285)**2) * 1.4)
    left = np.exp(-(((x-235)/620)**2 + ((y-260)/300)**2) * 1.2)
    center = np.exp(-(((x-670)/490)**2 + ((y-239)/130)**2))
    pulse = .97 + .03 * (math.cos((t-5)*math.tau/AMBIENT_SECONDS) if t >= 5 else math.sin(t*.52))
    rgb = np.zeros((H, W, 3), dtype=np.uint8)
    for c, value in enumerate((4, 8, 12)):
        rgb[:, :, c] = np.clip(value + halo*(3, 9, 16)[c]*pulse + left*(0, 2, 5)[c]
                              + center*(0, 2, 4)[c], 0, 255)
    return Image.fromarray(rgb, "RGB").convert("RGBA")


def field_position(point, t, ambient):
    x, y, z, size, phase = point
    # The near field advances faster than the far field and gradually opens up.
    travel = min(t, 5) / 5
    factor = 1 + z * .45 * travel
    px = x*factor - z*50*travel
    py = (y-H/2)*factor + H/2
    if ambient:
        px = FIELD_LEFT + ((px-FIELD_LEFT + FIELD_SPAN*(t-5)/AMBIENT_SECONDS) % FIELD_SPAN)
        py += math.sin((t-5)*math.tau/AMBIENT_SECONDS + phase)*1.5
    return px, py, size*(.5+z*1.5)


def field_fade(x):
    return smooth((x-FIELD_LEFT)/105) * (1-smooth((x-540)/405))


def render(t, ambient=False):
    image = backdrop(t)
    atmosphere = Image.new("RGBA", (W, H))
    ad = ImageDraw.Draw(atmosphere, "RGBA")
    # Deep, feathered beams trace toward the title from outside the left frame.
    for j in range(5):
        yy = 100 + j*71
        a = 3 + j % 2
        ad.polygon([(-80, yy-46), (630, 205+j*7), (670, 216+j*7), (-80, yy+64)],
                   fill=(55, 100, 144, a))
    atmosphere = atmosphere.filter(ImageFilter.GaussianBlur(33))
    image = Image.alpha_composite(image, atmosphere)

    network = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(network, "RGBA")
    positioned = [field_position(point, t, ambient) for point in FIELD]
    for i, j in LINES:
        x1, y1, _ = positioned[i]
        x2, y2, _ = positioned[j]
        if math.hypot(x1-x2, y1-y2) > 150:
            continue
        cycle = (t-5)*math.tau/AMBIENT_SECONDS if ambient else t*.7
        opacity = round((19 + 31*FIELD[i][2]) * (.88 + .12*math.sin(cycle+i)) *
                        min(field_fade(x1), field_fade(x2)))
        d.line((x1, y1, x2, y2), fill=(111, 160, 207, opacity), width=1)
    for i, (x, y, scale) in enumerate(positioned):
        z = FIELD[i][2]
        flicker = .8 + .2*math.sin(((t-5)*math.tau/AMBIENT_SECONDS if ambient else t*1.4)+FIELD[i][4])
        r = .45 + scale*.68
        fade = field_fade(x)
        d.ellipse((x-r, y-r, x+r, y+r), fill=(189, 224, 250, int((61+142*z)*flicker*fade)))
        if i % 9 == 0:
            d.ellipse((x-r*2.5, y-r*2.5, x+r*2.5, y+r*2.5), outline=(75, 137, 190, int(24*fade)))
    for i, (sx, sy, z, size, rotation, phase) in enumerate(SHARDS):
        travel = min(t, 5)/5
        x = sx*(1+z*.58*travel)-z*39*travel
        y = (sy-H/2)*(1+z*.43*travel)+H/2
        if ambient:
            x = FIELD_LEFT + ((x-FIELD_LEFT + FIELD_SPAN*(t-5)/AMBIENT_SECONDS) % FIELD_SPAN)
        size *= (.38+z*.95)*(1+.38*travel)
        angle = rotation + (1-travel)*t*(.22+.22*z)
        if ambient:
            angle += math.sin((t-5)*math.tau/AMBIENT_SECONDS+phase)*.035
        corners = []
        for k, radius in enumerate((1, .84, 1.28, .59)):
            a = angle+k*math.tau/4
            corners.append((x+math.cos(a)*size*radius, y+math.sin(a)*size*radius*.83))
        cycle = (t-5)*math.tau/AMBIENT_SECONDS if ambient else t*.48
        alpha = round((28+112*z)*(.82+.18*math.sin(cycle+phase))*field_fade(x))
        d.polygon(corners, fill=(37, 77, 113, alpha//4))
        d.line(corners+[corners[0]], fill=(171, 208, 238, alpha), width=1)
        d.line((corners[0], corners[2]), fill=(178, 216, 246, alpha//2), width=1)
        d.line((corners[1], corners[3]), fill=(133, 180, 217, alpha//3), width=1)
        if i % 3 == 0:
            d.polygon((corners[0], corners[1], corners[2]), fill=(163, 205, 238, alpha//4))

    face = Image.new("RGBA", (W, H))
    fd = ImageDraw.Draw(face, "RGBA")
    edges = Image.new("RGBA", (W, H))
    ed = ImageDraw.Draw(edges, "RGBA")
    for i, item in enumerate(FACETS):
        progress = 1 if ambient else smooth((t - .34 - item["delay"]) / 2.35)
        if progress == 0:
            # A fraction is visible deep in the field from the first frame.
            if t < item["delay"]*.2 or i % 3:
                continue
        scale = item["depth"]*(1-progress) + progress
        angle = item["rot"]*(1-progress)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        cx = item["sx"]*(1-progress) + item["cx"]*progress
        cy = item["sy"]*(1-progress) + item["cy"]*progress
        poly = []
        for px, py in item["poly"]:
            dx, dy = px-item["cx"], py-item["cy"]
            poly.append((cx + scale*(dx*cos_a-dy*sin_a), cy + scale*(dx*sin_a+dy*cos_a)))
        opacity = int((.24 + .76*progress) * (145 + (i*53 % 94)))
        if ambient:
            opacity = int(opacity*(.975+.025*math.sin((t-5)*math.tau/AMBIENT_SECONDS+i*.7)))
        color = (*item["shade"], opacity)
        fd.polygon(poly, fill=color)
        ed.line(poly+[poly[0]], fill=(156, 204, 240, int(opacity*.42)), width=1)
        if i % 8 == 0:
            ed.ellipse((cx-1.5, cy-1.5, cx+1.5, cy+1.5), fill=(227, 245, 255, int(opacity*.86)))
    if ambient or t > 3.25:
        # Crisp glyph contours resolve only after the fragments reach their coordinates.
        mask = brain_mask if ambient else ImageChops.lighter(
            Image.new("L", (W, H), int((1-smooth((t-3.25)/1.1))*255)), brain_mask)
        face.putalpha(ImageChops.multiply(face.getchannel("A"), mask))
        edges.putalpha(ImageChops.multiply(edges.getchannel("A"), mask))
    network = Image.alpha_composite(network, face)
    network = Image.alpha_composite(network, edges)

    # The moving facets settle into exactly the same font, cap height and
    # off-white material as STORM. The solid pass also closes every edge pixel.
    solid_brain = Image.new("RGBA", (W, H), (238, 243, 248, 255))
    solid_reveal = 1 if ambient else smooth((t-3.45)/1.35)
    solid_brain.putalpha(brain_mask.point(lambda value: round(value*solid_reveal)))
    network = Image.alpha_composite(network, solid_brain)

    # STORM is established typography. A restrained light pass joins it to BRAIN.
    storm = Image.new("RGBA", (W, H), (238, 243, 248, 255))
    sm = storm_mask.copy()
    reveal = 1 if ambient else .68 + .32*smooth((t-.6)/3)
    sm = sm.point(lambda v: round(v*reveal))
    storm.putalpha(sm)
    network = Image.alpha_composite(network, storm)

    glow = network.filter(ImageFilter.GaussianBlur(13))
    glow.putalpha(glow.getchannel("A").point(lambda a: int(a*.20)))
    image = Image.alpha_composite(image, glow)
    image = Image.alpha_composite(image, network)
    return image.convert("RGB")


def video(filename, duration, offset=0, ambient=False):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium",
           "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / filename)]
    with subprocess.Popen(cmd, stdin=subprocess.PIPE) as proc:
        for frame in range(duration*FPS):
            image = render(offset + frame/FPS, ambient)
            proc.stdin.write(image.tobytes())
        proc.stdin.close()
        if proc.wait():
            raise RuntimeError(f"ffmpeg failed to write {filename}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true", help="Render keyframes only")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    render(0).save(OUT / "hero-first.jpg", quality=88, subsampling=0)
    render(5, True).save(OUT / "hero-rest.jpg", quality=90, subsampling=0)
    print(f"Rendered {len(FACETS)} mapped facets and {len(FIELD)} depth nodes")
    if args.preview:
        render(2.5).save(OUT / "hero-mid.jpg", quality=88, subsampling=0)
    else:
        video("hero-intro.mp4", 5)
        video("hero-ambient.mp4", AMBIENT_SECONDS, offset=5, ambient=True)


if __name__ == "__main__":
    main()
