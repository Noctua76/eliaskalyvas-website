# Cinematic hero plates

Generate the approved geometric/Vitruvian motif assets with `python3 scripts/render_hero_production.py`. It uses `scripts/preview_hero_motifs.py` and the stored figure texture, compositing only the background pass before the unchanged title layers from `scripts/render_hero.py`.

The site plays `hero-sequence.mp4`: a 5-second introduction followed by 48 seconds of ambient motion. `hero-intro.mp4` and `hero-ambient.mp4` contain those same intervals. The stills provide the poster and reduced-motion/mobile fallback. Playback seeks to second 5 at the end of the sequence. All videos are 1536×540, 24 fps, H.264/yuv420p, faststart, without audio.

The prior production hero is preserved by Git tag `hero-baseline-pre-vitruvian-2026-10-05`, pointing to commit `49658819e195bc469810478d67e29629effff737`. Restore the five active hero assets and `src/main.jsx` from that tag for an exact rollback; the original `scripts/render_hero.py` remains unchanged.
