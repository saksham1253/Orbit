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
import { X } from 'lucide-react';
import useLiftoffStore from './liftoffStore';
import useAppearanceStore from '../store/appearanceStore';
import { getTier } from './tiers';
import { LiftoffEngine } from './liftoffEngine';
import { playLiftoffChime } from './liftoffSound';
import { buildShareCard, shareOrDownload } from './shareCard';
import RankMomentCard from './RankMomentCard';
import { isPromotion, momentCopy } from './momentCopy';
import './LiftoffOverlay.css';

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
  const isQuasar = event ? getTier(event.toTierId).category === 'quasar' : false;
  const variant = isQuasar ? 'quasar' : (isDown ? 'down' : 'up');
  const reduced = useMemo(
    () => (typeof window !== 'undefined' &&
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    []
  );
  const speed = getSpeed ? getSpeed() : 1;
  // Rank-DOWN now plays its own calm "cooling / settling" canvas (v4 §5) — still
  // dignified, never explosive. Only reduced-motion / Animation-Speed 0 fall
  // back to the plain crossfade.
  const stillMode = reduced || speed === 0; // crossfade instead of canvas storm
  // The card itself reveals calmly on a descent (gentle fade, no celebratory
  // spring pop) even while the cooling canvas plays behind it.
  const cardStill = stillMode || isDown;

  const copy = event
    ? momentCopy({ variant, tierId: event.toTierId, fromTierId: event.fromTierId, pointsToRecover: event.pointsToRecover, city: event.city })
    : null;

  // Run the cinematics when an event arrives.
  // The reveal-state transitions below are intentional, imperative cinematic
  // sequencing (reset on new event, then the v3 "never blank" safety reveal),
  // not derived state — so the set-state-in-effect rule is scoped-off here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!event) return;
    setRevealed(false);

    // Chime obeys UI Sounds. Quasar → its own grandest cue (v7 §6); rank-UP →
    // bright rising fanfare (grand for category promotions, sparkle for
    // within-tier); rank-DOWN → a distinct soft descending cooling cue (v5 §1).
    // One play per event (keyed on event.id).
    if (isQuasar) playLiftoffChime(false, { quasar: true });
    else if (isDown) playLiftoffChime(false, { down: true });
    else playLiftoffChime(promotion, { category: getTier(event.toTierId).category });

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
        descent: isDown,
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
        filename: `orbit-${event.toTierId}.png`,
        text: `${tier.displayName} — ${copy?.support} on Orbit`,
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
        className={`liftoff-overlay liftoff-cat-${tier.category} ${isDown ? 'liftoff-down' : ''}`}
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
          <RankMomentCard
            variant={variant}
            tierId={event.toTierId}
            fromTierId={event.fromTierId}
            score={event.score}
            pointsToRecover={event.pointsToRecover}
            city={event.city}
            revealed={revealed}
            stillMode={cardStill}
            sharing={sharing}
            onShare={handleShare}
            onContinue={clear}
          />
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
