/**
 * OrbitTeaserReveal — the "stardust reveal" brand animation as a React component.
 *
 * In-app port of marketing/orbit-teaser-reveal.html. The "Orbit" name is already
 * revealed; its two slogans de-blur and shed glowing ashes, the ashes gather to a
 * split point and fan out as four flowing streams, and the four UI cards
 * materialise slowly along the planet's orbit — resolving to the exact
 * composition of FrontEnd/public/og-image-teaser.png. ~8.5s, then a gentle hold.
 *
 * The Saturn mark is the exact orbit-app.svg logo, inlined and scaled up.
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
import { playSpaceReveal } from './orbitRevealSound';
import './OrbitTeaserReveal.css';

const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The four cards (buckets) — centres match the .otr-c-* positions in the CSS.
// Ashes pour into all four in parallel.
const CARDS = [
  { x: 150, y: 210 }, // streak
  { x: 470, y: 150 }, // leaderboard
  { x: 520, y: 520 }, // league
  { x: 210, y: 560 }, // points
];
const PER_CARD = 100; // grains per bucket (dense, visible ash)
const EMIT_START = 2.1; // continuous stream window (s)
const EMIT_SPREAD = 3.2;
// SLOGAN band the ashes lift off from — the draining "tank".
const SLOGAN = { x0: 705, y0: 396, x1: 1210, y1: 486 };
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
  const out = [];
  // Emit a continuous stream into every bucket so the tank drains and the four
  // buckets fill smoothly and in parallel — delay spread across the emit window.
  CARDS.forEach((card) => {
    for (let i = 0; i < PER_CARD; i++) {
      const sx = rand(SLOGAN.x0, SLOGAN.x1);
      const sy = rand(SLOGAN.y0, SLOGAN.y1);
      const ex = card.x + rand(-46, 46); // land scattered on the card
      const ey = card.y + rand(-26, 26);
      const size = rand(2.6, 7.6); // bigger, clearly-visible grains
      const col = PALETTE[(Math.random() * PALETTE.length) | 0];
      const delay = EMIT_START + (i / PER_CARD) * EMIT_SPREAD + Math.random() * 0.22;
      out.push({
        style: {
          '--sx': `${sx}px`,
          '--sy': `${sy}px`,
          '--dx': `${ex - sx}px`,
          '--dy': `${ey - sy}px`,
          '--delay': `${delay}s`,
          '--dur': `${rand(1.0, 1.4)}s`,
          width: `${size}px`,
          height: `${size}px`,
          background: `radial-gradient(circle, ${col}, rgba(255,255,255,0) 70%)`,
          boxShadow: `0 0 ${6 + size * 1.6}px ${col}`,
        },
      });
    }
  });
  return out;
}

export default function OrbitTeaserReveal({ onComplete, standalone = false, sound = true }) {
  // runId re-mounts the animated subtree to replay from t=0.
  const [runId, setRunId] = useState(0);
  const [scale, setScale] = useState(1);
  const [soundOn, setSoundOn] = useState(sound);
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

  // Fire onComplete once the reveal has settled (~8.5s), re-armed on replay.
  useEffect(() => {
    if (!onComplete) return undefined;
    const t = setTimeout(onComplete, 8500);
    return () => clearTimeout(t);
  }, [onComplete, runId]);

  // Play the space transition sound in sync with each reveal (start + replay).
  // Reduced-motion users get silence. The first play on mount may be blocked by
  // the browser's autoplay policy until a gesture; the Replay / Sound buttons
  // (which are user gestures) always play it in sync.
  useEffect(() => {
    if (soundOn && !PREFERS_REDUCED_MOTION) playSpaceReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const replay = () => setRunId((n) => n + 1);
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next && !PREFERS_REDUCED_MOTION) replay(); // replay + sound together
  };

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

            {/* Saturn mark: the exact orbit-app.svg logo */}
            <div className="otr-planet">
              <div className="otr-float">
                <svg className="otr-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
                  <defs>
                    <linearGradient id="otrSp" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#00c6ff" />
                      <stop offset=".5" stopColor="#7c3aed" />
                      <stop offset="1" stopColor="#ff0076" />
                    </linearGradient>
                    <radialGradient id="otrSpp" cx=".36" cy=".32" r=".8">
                      <stop offset="0" stopColor="#e8f3ff" />
                      <stop offset=".4" stopColor="#86acff" />
                      <stop offset="1" stopColor="#4b1fb8" />
                    </radialGradient>
                  </defs>
                  <circle cx="78" cy="24" r="3" fill="#cfe6ff" opacity=".9" />
                  <g transform="rotate(-24 50 50)">
                    <ellipse cx="50" cy="50" rx="41" ry="14.5" fill="none" stroke="url(#otrSp)" strokeWidth="5.5" />
                    <circle cx="50" cy="50" r="22" fill="url(#otrSpp)" />
                    <ellipse cx="42" cy="42" rx="9" ry="6" fill="#fff" opacity=".18" />
                    <path d="M10 50 A41 14.5 0 0 0 90 50" fill="none" stroke="url(#otrSp)" strokeWidth="5.5" strokeLinecap="round" />
                    <circle r="2.4" fill="#fff" opacity=".95">
                      <animateMotion dur="7s" repeatCount="indefinite" path="M9,50 a41,14.5 0 1,0 82,0 a41,14.5 0 1,0 -82,0" />
                    </circle>
                  </g>
                </svg>
              </div>
            </div>

            {/* Wordmark + taglines */}
            <div className="otr-copy">
              <div className="otr-word">Orbit</div>
              <div className="otr-tagline">Learn in each other&rsquo;s orbit.</div>
              <div className="otr-sub">Teach what you know. Learn what you don&rsquo;t.</div>
            </div>

            {/* Stardust streams (particles pour into the cards) */}
            {dust.map((d, i) => (
              <div key={i} className="otr-dust" style={d.style} />
            ))}

            {/* UI cards (buckets) */}
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
          <button className="otr-btn" onClick={replay}>
            ↻ Replay
          </button>
          <button className={`otr-btn${soundOn ? '' : ' ghost'}`} onClick={toggleSound}>
            {soundOn ? '🔊 Sound on' : '🔇 Sound off'}
          </button>
          <Link className="otr-btn ghost" to="/">
            Back to home
          </Link>
        </div>
      )}
    </div>
  );
}
