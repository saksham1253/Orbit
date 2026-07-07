/**
 * PhotonsChip — the game-style Photons currency pill: [PhotonIcon] 1,240 (+).
 * Single source of truth: the ['orbit','me'] query (`data.photons ?? data.stardust`),
 * so it updates instantly on any earn/spend (mission claim, freeze buy, cosmetic
 * buy all write/invalidate that cache). Tapping the chip or the + opens the shop.
 *
 * Micro-interactions (research-backed, ≤600ms, reduced-motion safe):
 *   - count-up when the balance changes (rolls, never jumps);
 *   - a sparkle burst + pulse when Photons are EARNED (balance increases);
 *   - press-scale + a light APK haptic.
 * Under `prefers-reduced-motion` it skips motion but still updates the number.
 *
 * Mirrors cosmic/OrbitStreakBadge.jsx (same pill visual family).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate, useReducedMotion } from 'framer-motion';
import PhotonIcon from './PhotonIcon';
import { useOrbit } from './useOrbit';

const SPARKS = [
  { x: -14, y: -12 }, { x: 12, y: -14 }, { x: 16, y: 6 }, { x: -12, y: 8 }, { x: 0, y: -18 },
];

export default function PhotonsChip({ variant = 'nav', className = '' }) {
  const { data } = useOrbit();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const amount = data ? (data.photons ?? data.stardust ?? 0) : 0;

  const mv = useMotionValue(amount);
  const [display, setDisplay] = useState(amount);
  const [burst, setBurst] = useState(0);         // bumped on each earn → retriggers sparkles
  const prevRef = useRef(amount);
  const seededRef = useRef(false);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = amount;
    // Celebrate only real in-session earns (not the first data load).
    if (seededRef.current && amount > prev) {
      setBurst((b) => b + 1);
      try { if (!reduce && navigator.vibrate) navigator.vibrate(12); } catch { /* no haptics */ }
    }
    seededRef.current = true;

    if (reduce) { setDisplay(amount); mv.set(amount); return; }
    const controls = animate(mv, amount, {
      duration: 0.6, ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [amount, reduce, mv]);

  if (!data) return null;

  const iconSize = variant === 'nav' ? 15 : 20;
  const openShop = () => navigate('/orbit');    // Phase 2: switch to '/shop'
  const zero = amount <= 0;

  return (
    <div className={`relative inline-flex ${className}`}>
      <motion.button
        type="button"
        onClick={openShop}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        title={`${amount.toLocaleString()} Photons — open the shop`}
        aria-label={`${amount.toLocaleString()} Photons. Open shop.`}
        className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-violet-400/50 bg-white/5 backdrop-blur
          ${variant === 'nav' ? 'px-2 py-1' : 'px-3 py-1.5'} text-violet-100`}
        style={{ boxShadow: '0 0 14px rgba(139,92,246,.25)' }}
        animate={burst && !reduce ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 0.35 }}
      >
        <PhotonIcon size={iconSize} className={zero ? 'opacity-70' : ''} />
        <span className={`font-bold tabular-nums leading-none ${variant === 'nav' ? 'text-sm' : 'text-base'}`}>
          {display.toLocaleString()}
        </span>
        <span
          role="button"
          aria-label="Get more Photons"
          onClick={(e) => { e.stopPropagation(); openShop(); }}
          className="ml-0.5 grid place-items-center rounded-full text-slate-900 font-black leading-none"
          style={{ width: 16, height: 16, fontSize: 12, background: 'linear-gradient(135deg,#38bdf8,#ec4899)' }}
        >+</span>
      </motion.button>

      {/* earn sparkle burst */}
      <AnimatePresence>
        {burst > 0 && !reduce && (
          <div key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-start" style={{ paddingLeft: 8 }}>
            {SPARKS.map((s, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{ width: 4, height: 4, background: i % 2 ? '#38bdf8' : '#ec4899', boxShadow: '0 0 6px rgba(168,85,247,.9)' }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
                transition={{ duration: 0.7, delay: i * 0.03, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
