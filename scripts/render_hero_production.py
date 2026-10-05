"""Render the approved motif pass without editing the locked title renderer."""
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image

from preview_hero_motifs import ROOT, background, frame, hero


def main():
    figure = Image.open(ROOT / 'scripts/assets/hero-vitruvian.png').convert('RGBA')
    output = ROOT / 'public/assets/hero'
    for t, ambient in [(0, False), (.75, False), (2.5, False), (5, True), (17, True), (53, True)]:
        _, locked = frame(t, ambient)
        _, actual = frame(t, ambient, background(t, figure))
        assert actual == locked, 'Title layers differ from the approved baseline'
    start, _ = frame(5, True, background(5, figure))
    end, _ = frame(53, True, background(53, figure))
    assert np.array_equal(np.asarray(start), np.asarray(end)), 'Ambient loop does not close'
    first, _ = frame(0, False, background(0, figure))
    first.save(output / 'hero-first.jpg', quality=88, subsampling=0)
    start.save(output / 'hero-rest.jpg', quality=90, subsampling=0)

    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{hero.W}x{hero.H}',
               '-r', str(hero.FPS), '-i', '-', '-filter_complex',
               '[0:v]split=3[seq][i][a];[i]trim=end=5,setpts=PTS-STARTPTS[intro];'
               '[a]trim=start=5,setpts=PTS-STARTPTS[ambient]']
    for stream, name in [('seq', 'hero-sequence.mp4'), ('intro', 'hero-intro.mp4'), ('ambient', 'hero-ambient.mp4')]:
        command += ['-map', f'[{stream}]', '-an', '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '20', '-pix_fmt', 'yuv420p', '-g', str(hero.FPS * 2)]
        if stream == 'seq':
            command += ['-force_key_frames', '5']
        command += ['-movflags', '+faststart', str(output / name)]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
        for index in range(53 * hero.FPS):
            t = index / hero.FPS
            image, _ = frame(t, t >= 5, background(t, figure))
            process.stdin.write(image.tobytes())
            if index % (5 * hero.FPS) == 0:
                print(f'Rendered {t:.0f}/53 seconds', flush=True)
        process.stdin.close()
        if process.wait():
            raise RuntimeError('Production encoding failed')
    print('Production assets ready; title hashes and exact ambient loop closure passed', flush=True)


if __name__ == '__main__':
    main()
