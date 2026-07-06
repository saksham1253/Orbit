/**
 * OrbitTeaserReveal — the "stardust reveal" brand animation as a React component.
 *
 * In-app port of marketing/orbit-teaser-reveal.html. The blurred "Orbit"
 * wordmark disintegrates into stardust that reforms as four glowing UI cards
 * snapping onto the planet's orbit rings, resolving to the exact composition of
 * FrontEnd/public/og-image-teaser.png. ~8s choreography, then a gentle idle hold.
 *
 * Usage:
 *   <OrbitTeaserReveal onComplete={fn} />       // one-shot, transparent overlay
 *   <OrbitTeaserReveal standalone />            // full-screen page (the /reveal route)
 *
 * The stage is authored at a fixed 1280×720 (16:9); we scale it to fit the
 * viewport in JS so every hard-coded position stays pixel-exact. Honors
 * prefers-reduced-motion (CSS snaps straight to the final frame).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './OrbitTeaserReveal.css';

// Card centres — must match the .otr-c-* rules in the CSS. Also the stardust
// stream destinations.
const CARDS = [
  { x: 150, y: 210 }, // streak
  { x: 470, y: 150 }, // leaderboard
  { x: 520, y: 520 }, // league
  { x: 210, y: 560 }, // points
];
// Wordmark + taglines bounding box (stage px) the stardust lifts off from.
const TEXT = { x0: 705, y0: 250, x1: 1215, y1: 470 };
const PALETTE = ['#ffffff', '#eaf6ff', '#bfe6ff', '#8ad4ff', '#ffd0e8', '#ffc46b'];

const STAGE_W = 1280;
const STAGE_H = 720;

const rand = (a, b) => a + Math.random() * (b - a);

function buildStars() {
  return Array.from({ length: 80 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    big: Math.random() > 0.8,
    delay: `${Math.random() * 3.4}s`,
  }));
}

function buildDust() {
  return Array.from({ length: 132 }, (_, i) => {
    const card = CARDS[i % CARDS.length];
    const sx = rand(TEXT.x0, TEXT.x1);
    const sy = rand(TEXT.y0, TEXT.y1);
    const ex = card.x + rand(-46, 46);
    const ey = card.y + rand(-30, 30);
    const size = rand(1.6, 5.0);
    const col = PALETTE[(Math.random() * PALETTE.length) | 0];
    return {
      style: {
        '--sx': `${sx}px`,
        '--sy': `${sy}px`,
        '--dx': `${ex - sx}px`,
        '--dy': `${ey - sy}px`,
        '--dur': `${rand(1.9, 2.25)}s`,
        width: `${size}px`,
        height: `${size}px`,
        background: `radial-gradient(circle, ${col}, rgba(255,255,255,0) 72%)`,
        boxShadow: `0 0 ${4 + size}px ${col}`,
      },
    };
  });
}

export default function OrbitTeaserReveal({ onComplete, standalone = false }) {
  // runId re-mounts the animated subtree to replay from t=0.
  const [runId, setRunId] = useState(0);
  const [scale, setScale] = useState(1);
  const fitRef = useRef(null);

  // Regenerate the random starfield/stardust each run. runId is a deliberate
  // dependency (not used inside) so replay reshuffles the particles.
  /* eslint-disable react-hooks/exhaustive-deps */
  const stars = useMemo(() => buildStars(), [runId]);
  const dust = useMemo(() => buildDust(), [runId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Scale the fixed 1280×720 stage to fit its container.
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const parent = el.parentElement;
    const measure = () => {
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      setScale(Math.min(w / STAGE_W, h / STAGE_H, 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (parent) ro.observe(parent);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Fire onComplete once the reveal has settled (~8s), re-armed on replay.
  useEffect(() => {
    if (!onComplete) return undefined;
    const t = setTimeout(onComplete, 8000);
    return () => clearTimeout(t);
  }, [onComplete, runId]);

  return (
    <div className="otr">
      <div className="otr-fit" ref={fitRef} style={{ '--otr-scale': scale }}>
        {/* keyed subtree → replay restarts every CSS animation */}
        <div className="otr-stage" key={runId}>
          <div className="otr-dolly">
            {stars.map((s, i) => (
              <div
                key={i}
                className={`otr-star${s.big ? ' big' : ''}`}
                style={{ left: s.left, top: s.top, animationDelay: s.delay }}
              />
            ))}
            <div className="otr-comet" />

            {/* Saturn mark */}
            <div className="otr-planet">
              <div className="otr-float">
                <div className="otr-ring" />
                <div className="otr-core" />
                <div className="otr-orbiter" />
              </div>
            </div>

            {/* Wordmark + taglines */}
            <div className="otr-copy">
              <div className="otr-word">Orbit</div>
              <div className="otr-tagline">Learn in each other&rsquo;s orbit.</div>
              <div className="otr-sub">Teach what you know. Learn what you don&rsquo;t.</div>
            </div>

            {/* Stardust */}
            {dust.map((d, i) => (
              <div key={i} className="otr-dust" style={d.style} />
            ))}

            {/* UI cards */}
            <div className="otr-card otr-c-streak">
              <span className="ico">🔥</span>
              <span>
                <span className="big">14</span> <span className="lbl">day streak</span>
              </span>
            </div>
            <div className="otr-card otr-c-board">
              <span className="ico">🏆</span>
              <span className="name">Leaderboard</span>
            </div>
            <div className="otr-card otr-c-league">
              <span className="ico">💎</span>
              <span className="name">League</span>
            </div>
            <div className="otr-card otr-c-points">
              <span className="ico">✨</span>
              <span className="name">Points: 5,200</span>
            </div>
          </div>
        </div>
      </div>

      {standalone && (
        <div className="otr-controls">
          <button className="otr-btn" onClick={() => setRunId((n) => n + 1)}>
            ↻ Replay
          </button>
          <Link className="otr-btn ghost" to="/">
            Back to home
          </Link>
        </div>
      )}
    </div>
  );
}
