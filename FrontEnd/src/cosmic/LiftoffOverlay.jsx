/**
 * LiftoffOverlay — the full-screen rank-up "Liftoff" moment (spec §8).
 *
 * Reads the pending event from liftoffStore and plays a cinematic sequence:
 * category promotions get the goosebump treatment (implosion → ignition flash →
 * category-specific signature burst → badge reveal + headline + shareable card);
 * within-tier promotions get a quick intensify + sparkle.
 *
 * Accessibility (spec §8): under prefers-reduced-motion OR Animation Speed = 0
 * the canvas storm is skipped entirely and replaced with a calm crossfade to
 * the new badge. The chime obeys the UI Sounds toggle. Timings scale with the
 * Animation Speed multiplier.
 *
 * Self-contained: mounted once at the app root; renders nothing until an event
 * arrives, so it is inert for every existing flow.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Sparkles } from 'lucide-react';
import useLiftoffStore from './liftoffStore';
import useAppearanceStore from '../store/appearanceStore';
import CosmicBadge from './CosmicBadge';
import { getTier, TIER_ORDER } from './tiers';
import { LiftoffEngine } from './liftoffEngine';
import { playLiftoffChime } from './liftoffSound';
import { buildShareCard, shareOrDownload } from './shareCard';
import './LiftoffOverlay.css';

const idx = (tierId) => TIER_ORDER.indexOf(tierId);
const isPromotion = (fromId, toId) => {
  if (!fromId) return getTier(toId).category !== 'moon' ? true : false; // first reveal: treat non-moon as grand
  return getTier(fromId).category !== getTier(toId).category && idx(toId) > idx(fromId);
};

function headlineFor(tierId, city, direction, pointsToRecover, fromTierId) {
  const t = getTier(tierId);
  const where = city ? ` over ${city}'s sky` : '';

  // v4 §5 — rank-DOWN: dignified, encouraging, never shaming. Always forward-
  // looking with the exact points to recover.
  if (direction === 'down') {
    const recover = pointsToRecover != null
      ? ` You need +${pointsToRecover} to return to ${getTier(fromTierId).displayName}.`
      : '';
    const calm = {
      asteroid: "Your light dimmed a little — you're now",
      meteor:   "You've cooled into",
      stardust: "You've drifted out to",
      moon:     "You've cooled to",
      planet:   "You've cooled to",
      star:     "You've cooled from a brighter sky to",
      pulsar:   "You've eased down to",
      supernova:"You've settled to",
      galaxy:   "You've eased down to",
    };
    return {
      kicker: 'STILL BURNING',
      line: `${calm[t.category] || 'You moved to'} ${t.displayName}. Stars flicker; climb back.${recover}`,
    };
  }

  // Rank-UP / intro (warm, hopeful — including the Descent's "rising" theme).
  switch (t.category) {
    case 'stardust':  return { kicker: 'A SPARK CATCHES', line: `You're gathering light again — ${t.displayName}.` };
    case 'meteor':    return { kicker: 'STILL ON FIRE', line: `You're rising — ${t.displayName}.` };
    case 'asteroid':  return { kicker: 'GATHERING MASS', line: `Almost a world again — ${t.displayName}.` };
    case 'moon':      return { kicker: 'BACK IN ORBIT', line: `You've gathered enough mass to hold an orbit again — ${t.displayName}.` };
    case 'planet':    return { kicker: 'A WORLD IS BORN', line: `You've ascended to ${t.displayName}.` };
    case 'star':      return { kicker: 'IGNITION', line: `You now generate your own light — ${t.displayName}.` };
    case 'pulsar':    return { kicker: 'A LIGHTHOUSE RISES', line: `You're a pulsar${where} — ${t.displayName}.` };
    case 'supernova': return { kicker: 'SUPERNOVA', line: `The whole community is watching — ${t.displayName}.` };
    case 'galaxy':    return { kicker: 'ANDROMEDA CLASS', line: `A universe unto yourself — ${t.displayName}.` };
    case 'quasar':    return { kicker: 'BEYOND THE LADDER', line: `You are ${t.displayName} — shining forever.` };
    default:          return { kicker: "YOU'VE GROWN", line: `Welcome to ${t.displayName}.` };
  }
}

export default function LiftoffOverlay() {
  const event = useLiftoffStore((s) => s.event);
  const clear = useLiftoffStore((s) => s.clear);
  const getSpeed = useAppearanceStore((s) => s.getSpeedMultiplier);

  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const [sharing, setSharing] = useState(false);

  const promotion = event ? isPromotion(event.fromTierId, event.toTierId) : false;
  const isDown = event?.direction === 'down';
  const reduced = useMemo(
    () => (typeof window !== 'undefined' &&
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    []
  );
  const speed = getSpeed ? getSpeed() : 1;
  // Rank-DOWN is always a calm crossfade (no explosive canvas), per v4 §5.
  const stillMode = reduced || speed === 0 || isDown; // crossfade instead of canvas storm

  const head = event ? headlineFor(event.toTierId, event.city, event.direction, event.pointsToRecover, event.fromTierId) : null;

  // Run the cinematics when an event arrives.
  // The reveal-state transitions below are intentional, imperative cinematic
  // sequencing (reset on new event, then the v3 "never blank" safety reveal),
  // not derived state — so the set-state-in-effect rule is scoped-off here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!event) return;
    setRevealed(false);

    // Chime obeys UI Sounds. Rank-UP → bright rising fanfare (grand for category
    // promotions, sparkle for within-tier); rank-DOWN → a distinct soft
    // descending cooling cue (v5 §1). One play per event (keyed on event.id).
    if (isDown) playLiftoffChime(false, { down: true });
    else playLiftoffChime(promotion);

    const sp = Math.max(speed || 1, 0.2);
    let autoTimer, safetyTimer;

    // Still mode (reduced-motion / anim-speed 0): static reveal card, no canvas.
    if (stillMode) {
      setRevealed(true);
      autoTimer = setTimeout(() => clear(), 6500 / sp);
      return () => clearTimeout(autoTimer);
    }

    // v3 §1 — SAFETY REVEAL: the badge + headline must ALWAYS appear, even if
    // the canvas engine fails to init or never calls onReveal. This guarantees
    // we never show a blank/black overlay. The engine's onReveal can fire
    // earlier; this is the backstop.
    safetyTimer = setTimeout(() => setRevealed(true), 1200 / sp);

    let engine = null;
    try {
      engine = new LiftoffEngine(canvasRef.current, {
        category: getTier(event.toTierId).category,
        promotion,
        speed: speed || 1,
        onReveal: () => setRevealed(true),
        onDone: () => {},
      });
      engineRef.current = engine;
      engine.start();
    } catch (err) {
      // Engine failed → fall back to the static reveal card immediately.
      console.warn('Liftoff engine failed, showing static reveal:', err);
      setRevealed(true);
    }

    // Auto-dismiss a few seconds after the badge has settled.
    autoTimer = setTimeout(() => clear(), (promotion ? 9000 : 6000) / sp);

    return () => {
      clearTimeout(autoTimer);
      clearTimeout(safetyTimer);
      if (engine) engine.stop();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Esc to dismiss.
  useEffect(() => {
    if (!event) return;
    const onKey = (e) => { if (e.key === 'Escape') clear(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, clear]);

  const handleShare = async () => {
    if (!event) return;
    setSharing(true);
    try {
      const url = buildShareCard({ tierId: event.toTierId, score: event.score, city: event.city });
      await shareOrDownload(url, {
        filename: `skillswap-${event.toTierId}.png`,
        text: `${head?.line} — on SkillSwap 🛰️`,
      });
    } finally {
      setSharing(false);
    }
  };

  if (!event) return null;
  const tier = getTier(event.toTierId);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={event.id}
        className={`liftoff-overlay ${isDown ? 'liftoff-down' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        onClick={clear}
        role="dialog"
        aria-modal="true"
        aria-label={`Rank up: ${tier.displayName}`}
      >
        {!stillMode && <canvas ref={canvasRef} className="liftoff-canvas" aria-hidden="true" />}

        <button className="liftoff-close" onClick={clear} aria-label="Dismiss">
          <X size={20} />
        </button>

        <div className="liftoff-stage" onClick={(e) => e.stopPropagation()}>
          <AnimatePresence>
            {revealed && (
              <motion.div
                key="badge"
                initial={stillMode ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotate: -25 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={stillMode
                  ? { duration: 0.6 }
                  : { type: 'spring', stiffness: 160, damping: 14, mass: 0.8 }}
                className="liftoff-badge-wrap"
              >
                <div className={`liftoff-badge-halo cb-halo-${tier.category}`}>
                  <CosmicBadge tierId={event.toTierId} size="full" className="liftoff-badge" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {revealed && (
              <motion.div
                key="text"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: stillMode ? 0.2 : 0.35, duration: 0.6 }}
                className="liftoff-text"
              >
                <div className="liftoff-kicker">
                  {isDown ? 'A QUIET DESCENT' : (promotion ? 'LIFTOFF' : 'RANK UP')} · {head.kicker}
                </div>
                <h2 className="liftoff-headline">{head.line}</h2>
                {event.score != null && (
                  <div className="liftoff-score">CosmicScore {event.score}</div>
                )}

                <div className="liftoff-actions">
                  <button className="liftoff-share" onClick={handleShare} disabled={sharing}>
                    <Share2 size={15} /> {sharing ? 'Preparing…' : 'Share your card'}
                  </button>
                  <button className="liftoff-dismiss" onClick={clear}>
                    <Sparkles size={14} /> Continue
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
