import gsap from 'gsap';

const triangleCenter = element => {
  const points = element.querySelector('polygon').getAttribute('points').trim().split(/\s+/)
    .map(pair => pair.split(',').map(Number));
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length];
};

export function runHeroMotion(svg) {
  if (!svg) return undefined;
  const media = gsap.matchMedia(svg);

  media.add({ motion: '(prefers-reduced-motion: no-preference)', mobile: '(max-width: 650px)',
    tablet: '(min-width: 651px) and (max-width: 900px)', desktop: '(min-width: 901px)' }, context => {
    if (!context.conditions.motion) return undefined;
    const { mobile, tablet } = context.conditions;
    const desktopPointer = context.conditions.desktop && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const brain = [...svg.querySelectorAll('.geometry-piece')].filter((_, i) =>
      mobile ? (i + 1) % 4 !== 0 : !tablet || (i + 1) % 6 !== 0);
    const transition = [...svg.querySelectorAll('.transition-piece')].filter((_, i) =>
      mobile ? (i + 1) % 2 !== 0 : !tablet || (i + 1) % 3 !== 0);
    const facets = [...svg.querySelectorAll('.field-facets polygon')].filter((_, i) => !mobile || (i + 1) % 2 !== 0);
    const network = svg.querySelector('.word-network');
    const lines = [...network.querySelectorAll('line')];
    const nodes = [...network.querySelectorAll('circle')];
    const solidTransition = svg.querySelector('.word-transition');
    const solidEnd = svg.querySelector('.word-orm');
    const wires = svg.querySelector('.transition-wire');
    const transitionNodes = svg.querySelector('.transition-nodes');

    gsap.set([...brain, ...transition, ...facets, ...nodes], { transformOrigin: '50% 50%' });
    lines.forEach(line => {
      const length = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value,
        line.y2.baseVal.value - line.y1.baseVal.value);
      gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
    });

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    timeline.fromTo(network, { x: -21, opacity: 0 }, { x: 0, opacity: 1, duration: 2.0, ease: 'power2.out' }, 0)
      .to(lines, { strokeDashoffset: 0, duration: 1.8, stagger: { amount: .5 }, ease: 'power2.inOut' }, .16)
      .fromTo(nodes, { scale: .25, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, stagger: { amount: .7 } }, .18)
      .fromTo(facets, { x: -35, y: i => (i % 2 ? 26 : -22), rotation: i => (i % 2 ? 75 : -80), scale: .45, opacity: 0 },
        { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: 2.15, stagger: { amount: .55 } }, .1)
      .fromTo(brain, {
        x: (i, element) => -72 - triangleCenter(element)[0] * .59 + Math.sin(i * 2.31) * 36,
        y: i => Math.sin(i * 1.73) * 55,
        rotation: i => Math.sin(i * 2.13) * 150,
        scale: i => .28 + (i % 5) * .09,
        opacity: 0,
      }, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: mobile ? 2.25 : 2.55,
        ease: 'power3.inOut', stagger: { amount: mobile ? .35 : .55 } }, .19)
      .fromTo(transition, { x: i => -85 + Math.sin(i * 2.2) * 25, y: i => Math.cos(i * 1.6) * 28,
        rotation: i => Math.sin(i * 2.8) * 95, scale: .55, opacity: 0 },
      { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: 1.75, stagger: { amount: .25 } }, 1.14)
      .fromTo(solidTransition, { opacity: 0 }, { opacity: .38, duration: 1.4 }, 1.52)
      .fromTo([wires, transitionNodes], { opacity: 0 }, { opacity: .64, duration: 1.4 }, 1.52)
      .fromTo(solidEnd, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 1.2 }, 1.85);

    // Only a few facets and network points breathe after the single reconstruction.
    const living = [];
    brain.filter((_, i) => i % (mobile ? 49 : 31) === 0).forEach((element, i) => {
      living.push(gsap.to(element, { y: i % 2 ? -1.2 : 1.3, rotation: i % 2 ? -.75 : .85,
        duration: 5.5 + i % 4, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }));
    });
    nodes.filter((_, i) => i % (mobile ? 7 : 4) === 0).forEach((element, i) => {
      living.push(gsap.to(element, { y: i % 2 ? -1.4 : 1.2, opacity: .6,
        duration: 4.8 + i % 3, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }));
    });
    facets.filter((_, i) => i % 2 === 0).forEach((element, i) => {
      living.push(gsap.to(element, { y: i % 2 ? -1.7 : 1.4, rotation: i % 2 ? -1.1 : 1.1,
        duration: 6.5 + i % 3, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }));
    });
    const pulseLines = lines.filter((_, i) => i % 9 === 0);
    living.push(gsap.to(pulseLines, { opacity: .25, duration: 6.4, repeat: -1,
      yoyo: true, ease: 'sine.inOut', paused: true, stagger: .8 }));

    let onPointerMove;
    let onPointerLeave;
    let frame = 0;
    if (desktopPointer) {
      const candidates = brain.filter((_, i) => i % 11 === 4);
      const controls = candidates.map(element => ({
        center: triangleCenter(element),
        moveX: gsap.quickTo(element, 'x', { duration: .85, ease: 'power3.out' }),
        moveY: gsap.quickTo(element, 'y', { duration: .85, ease: 'power3.out' }),
      }));
      const networkX = gsap.quickTo(network, 'x', { duration: 1.2, ease: 'power2.out' });
      const networkY = gsap.quickTo(network, 'y', { duration: 1.2, ease: 'power2.out' });
      onPointerMove = event => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const point = svg.createSVGPoint();
          point.x = event.clientX;
          point.y = event.clientY;
          const local = point.matrixTransform(svg.getScreenCTM().inverse());
          const nearby = local.x >= -70 && local.x <= 385 && local.y >= 0 && local.y <= 125;
          controls.forEach(({ center, moveX, moveY }) => {
            const dx = center[0] - local.x;
            const dy = center[1] - local.y;
            const distance = Math.hypot(dx, dy);
            const reach = nearby ? Math.max(0, 1 - distance / 62) : 0;
            moveX(distance ? dx / distance * reach * 3 : 0);
            moveY(distance ? dy / distance * reach * 3 : 0);
          });
          networkX(nearby ? (local.x - 150) * .012 : 0);
          networkY(nearby ? (local.y - 60) * .012 : 0);
        });
      };
      onPointerLeave = () => {
        controls.forEach(({ moveX, moveY }) => { moveX(0); moveY(0); });
        networkX(0);
        networkY(0);
      };
    }

    timeline.eventCallback('onComplete', () => {
      living.forEach(tween => tween.play());
      if (desktopPointer) {
        svg.addEventListener('pointermove', onPointerMove, { passive: true });
        svg.addEventListener('pointerleave', onPointerLeave);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (desktopPointer) {
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerleave', onPointerLeave);
      }
    };
  });

  return () => media.revert();
}
