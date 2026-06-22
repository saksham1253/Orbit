/**
 * CometField — an ambient drifting-comet canvas, layered behind content.
 *
 * Transparent: it clears each frame (never paints a backdrop), so it composites
 * cleanly over any page background or the user's chosen background style. The
 * tail fades through the active theme's three colours.
 *
 * Accessibility / settings (matches CosmicLoader): under prefers-reduced-motion
 * OR Animation Speed = "Off" (multiplier 0) it renders nothing — a calm, static
 * page. Speed slow/medium/fast scales the comet's pace.
 *
 * Variants:
 *  - 'drift'   → one large, slow comet wandering across the void. Used behind the
 *                404 "lost in space" page — quiet but prominent.
 *  - 'ambient' → a smaller, fainter comet looping behind empty-state cards.
 *
 * The parent must be positioned (relative/absolute); the canvas fills it and is
 * pointer-transparent, so it never affects layout or clicks. Pure canvas, no deps.
 */
import { useEffect, useRef } from 'react';
import useAppearanceStore from '../store/appearanceStore';

const VARIANTS = {
  drift:   { r: 3.6, vx: 0.85, vy: -0.12, trail: 28, wob: 7,   head: 0.6 },
  ambient: { r: 2.2, vx: 0.6,  vy: 0.05,  trail: 16, wob: 3.5, head: 0.45 },
};

export default function CometField({ variant = 'drift', className = '', style }) {
  const canvasRef = useRef(null);
  const getColors = useAppearanceStore((s) => s.getColors);
  const getSpeed = useAppearanceStore((s) => s.getSpeedMultiplier);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = getSpeed ? getSpeed() : 1;
    if (reduced || speed === 0) return; // motion off → leave the page calm & static

    const canvas = canvasRef.current;
    const parent = canvas && canvas.parentElement;
    if (!canvas || !parent) return;

    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const colors = (getColors && getColors()) || ['#00c6ff', '#7c3aed', '#ff0076'];
    const cfg = VARIANTS[variant] || VARIANTS.drift;

    let W = 1, H = 1, comet, raf, last = null;
    const vx = cfg.vx * DPR * speed;
    const vy = cfg.vy * DPR * speed;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      W = canvas.width = Math.max(1, Math.round(rect.width * DPR));
      H = canvas.height = Math.max(1, Math.round(rect.height * DPR));
    };
    const spawn = () => {
      comet = { x: -0.14 * W, y0: H * (0.22 + Math.random() * 0.42), ph: Math.random() * Math.PI * 2 };
    };
    resize();
    spawn();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(parent);
    else window.addEventListener('resize', resize);

    const amp = cfg.wob * DPR;

    const frame = (ts) => {
      if (last === null) last = ts;
      const dt = Math.min((ts - last) / 16.67, 3); // elapsed 60fps-frames, clamped
      last = ts;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      comet.x += vx * dt;
      comet.y0 += vy * dt;
      comet.ph += 0.02 * dt;
      const hy = comet.y0 + Math.sin(comet.ph) * amp;

      // Tail: fading dots trailing the head, cycling the brand gradient.
      for (let k = cfg.trail - 1; k >= 0; k--) {
        const f = 1 - k / cfg.trail;
        const bx = comet.x - vx * k * 0.9;
        const by = hy - vy * k * 0.9;
        ctx.globalAlpha = f * 0.6;
        ctx.fillStyle = colors[k % colors.length] || colors[0];
        ctx.beginPath();
        ctx.arc(bx, by, cfg.r * DPR * (0.3 + f * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }

      // Glowing head.
      ctx.globalAlpha = 1;
      const hr = cfg.r * 3 * DPR;
      const g = ctx.createRadialGradient(comet.x, hy, 0, comet.x, hy, hr);
      g.addColorStop(0, `rgba(255,255,255,${cfg.head})`);
      g.addColorStop(0.45, colors[0]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(comet.x, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      if (comet.x > W + 0.18 * W) spawn(); // off the right edge → loop

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
    };
  }, [variant, getColors, getSpeed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
