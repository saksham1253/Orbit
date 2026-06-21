/**
 * MomentLab — admin Rank-Moment Simulator (v7 §7).
 *
 * Lets the owner trigger and watch EVERY rank moment — rank-up and rank-down for
 * any tier, plus the secret Quasar — using the REAL <RankMomentCard> and the REAL
 * sound cues, so what the admin previews is exactly what users experience (no
 * mock UI that could drift).
 *
 * STRICTLY PREVIEW-ONLY: runs entirely client-side from sample data. It never
 * touches the liftoffStore, never writes to the DB, never emits a real
 * notification, and never alters any user's cosmic record or rank-event log.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Repeat, Volume2, FastForward, X, ShieldCheck } from 'lucide-react';
import RankMomentCard from '../../cosmic/RankMomentCard';
import { isPromotion } from '../../cosmic/momentCopy';
import BadgeDefsSprite from '../../cosmic/BadgeDefsSprite';
import { LiftoffEngine } from '../../cosmic/liftoffEngine';
import { getTier, TIER_ORDER } from '../../cosmic/tiers';
import { playLiftoffChime, playDescentChime, playQuasarChime } from '../../cosmic/liftoffSound';
import soundManager from '../../utils/soundManager';
import '../../cosmic/LiftoffOverlay.css';

const VARIANTS = [['up', 'Rank-up'], ['down', 'Descent'], ['quasar', 'Quasar']];
const LADDER = TIER_ORDER.filter((id) => id !== 'quasar');
const CYCLE_MS = 2600;

/** Play the real cue for a variant (honors the UI Sounds toggle inside each fn). */
function playMomentSound(variant, fromTierId, toTierId) {
  if (variant === 'quasar') return playQuasarChime();
  if (variant === 'down') return playDescentChime();
  return playLiftoffChime(isPromotion(fromTierId, toTierId), { category: getTier(toTierId).category });
}

export default function MomentLab() {
  const [variant, setVariant] = useState('up');
  const [toTier, setToTier] = useState('moon_4');
  const [fromTier, setFromTier] = useState('');
  const [name, setName] = useState('Nova Rivera');
  const [score, setScore] = useState(53);
  const [forceMotion, setForceMotion] = useState(true);

  const [preview, setPreview] = useState(null); // { variant, tierId, fromTierId, score, revealed }
  const [cycling, setCycling] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playId, setPlayId] = useState(0);       // bumped per play → (re)starts the canvas engine

  const lastRef = useRef(null);
  const cycleRef = useRef(null);
  const revealTimer = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const effectiveTier = variant === 'quasar' ? 'quasar' : toTier;
  // Sound toggle lives HERE in the admin (mirrors soundManager) so the owner
  // never has to leave for the user-dashboard settings to hear previews.
  const [soundsOn, setSoundsOn] = useState(soundManager.isEnabled());
  const toggleSounds = () => setSoundsOn(soundManager.toggle());

  const stopCycle = useCallback(() => {
    if (cycleRef.current) { clearTimeout(cycleRef.current); cycleRef.current = null; }
    setCycling(false);
  }, []);

  const open = useCallback((opts) => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    const still = !forceMotion && opts.variant === 'down';
    lastRef.current = opts;
    setHasPlayed(true);
    setPreview({ ...opts, revealed: false, still });
    setPlayId((n) => n + 1);   // (re)start the cinematic canvas for this play
    // Reveal a beat later so the badge spring + text fade read as a "moment".
    revealTimer.current = setTimeout(() => {
      setPreview((p) => (p ? { ...p, revealed: true } : p));
    }, still ? 60 : 220);
    playMomentSound(opts.variant, opts.fromTierId, opts.tierId);
  }, [forceMotion]);

  const playMoment = () => {
    stopCycle();
    open({
      variant,
      tierId: effectiveTier,
      fromTierId: fromTier || null,
      score: score === '' ? null : Number(score),
      name,
    });
  };

  const replay = () => { if (lastRef.current) open(lastRef.current); };

  const soundOnly = () => playMomentSound(variant, fromTier || null, effectiveTier);

  const close = useCallback(() => {
    stopCycle();
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (engineRef.current) { engineRef.current.stop(); engineRef.current = null; }
    setPreview(null);
  }, [stopCycle]);

  // Run the REAL canvas cinematics (per-tier flashes/bursts) for each play, so
  // the admin preview is exactly what users see (v7 §7). Rank-down stays calm
  // (no burst); honours the "Force full animation" toggle.
  useEffect(() => {
    if (!playId) return undefined;
    const opts = lastRef.current;
    if (!opts || !canvasRef.current) return undefined;
    if (!forceMotion || opts.variant === 'down') return undefined;
    const category = opts.variant === 'quasar' ? 'quasar' : getTier(opts.tierId).category;
    const promotion = opts.variant === 'quasar' ? true : isPromotion(opts.fromTierId, opts.tierId);
    let engine = null;
    try {
      engine = new LiftoffEngine(canvasRef.current, { category, promotion, speed: 1, onReveal: () => {}, onDone: () => {} });
      engineRef.current = engine;
      engine.start();
    } catch { /* canvas best-effort — the card still shows */ }
    return () => { if (engine) engine.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId]);

  // Cycle through every tier (rank-up) then the Quasar, one after another.
  const cycleAll = () => {
    stopCycle();
    setCycling(true);
    // Full review set (v7 §7): every tier rank-UP, every tier rank-DOWN
    // (Descent), then the secret Quasar — so the admin sees & hears all three
    // variants for every tier in one pass.
    const sequence = [
      ...LADDER.map((id) => ({ variant: 'up', tierId: id, fromTierId: null, score: null, name })),
      ...LADDER.map((id) => ({ variant: 'down', tierId: id, fromTierId: null, score: null, name })),
      { variant: 'quasar', tierId: 'quasar', fromTierId: null, score: null, name },
    ];
    let i = 0;
    const step = () => {
      if (i >= sequence.length) { stopCycle(); return; }
      open(sequence[i]);
      i += 1;
      cycleRef.current = setTimeout(step, CYCLE_MS);
    };
    step();
  };

  // Esc closes the preview.
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, close]);

  // Clean up timers on unmount.
  useEffect(() => () => {
    if (cycleRef.current) clearTimeout(cycleRef.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const tierLabel = (id) => getTier(id).displayName;

  return (
    <div>
      <BadgeDefsSprite />
      <h1 className="ssctl-h1">Moment Lab</h1>
      <p className="ssctl-muted" style={{ marginTop: -6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldCheck size={14} color="var(--ss-accent)" />
        Preview-only — uses the real moment card &amp; sounds. No user data is read or changed.
      </p>

      <div className="ssctl-card" style={{ display: 'grid', gap: 16 }}>
        {/* Variant */}
        <div>
          <p className="ssctl-section-title">Variant</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {VARIANTS.map(([id, label]) => (
              <button key={id}
                className={`ssctl-btn ${variant === id ? '' : 'ssctl-btn-ghost'}`}
                style={{ minHeight: 36, fontSize: 13 }}
                onClick={() => setVariant(id)}>{label}</button>
            ))}
          </div>
        </div>

        {/* Tier + transition */}
        <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'block' }}>
            <span className="ssctl-section-title">Tier (to)</span>
            <select className="ssctl-input" value={effectiveTier} disabled={variant === 'quasar'}
              onChange={(e) => setToTier(e.target.value)}>
              {TIER_ORDER.map((id) => <option key={id} value={id}>{tierLabel(id)}</option>)}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <span className="ssctl-section-title">From (optional)</span>
            <select className="ssctl-input" value={fromTier} onChange={(e) => setFromTier(e.target.value)}>
              <option value="">— none —</option>
              {TIER_ORDER.map((id) => <option key={id} value={id}>{tierLabel(id)}</option>)}
            </select>
          </label>
        </div>

        {/* Sample data */}
        <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'block' }}>
            <span className="ssctl-section-title">Sample name</span>
            <input className="ssctl-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sample name" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="ssctl-section-title">CosmicScore</span>
            <input className="ssctl-input" type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 53" />
          </label>
        </div>

        {/* Motion + sound overrides */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }} className="ssctl-muted">
          <input type="checkbox" checked={forceMotion} onChange={(e) => setForceMotion(e.target.checked)} />
          Force full animation (override reduced-motion / Descent crossfade)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }} className="ssctl-muted">
          <input type="checkbox" checked={soundsOn} onChange={toggleSounds} />
          Enable preview sound (toggles UI Sounds — no need to leave the admin)
        </label>

        {!soundsOn && (
          <p className="ssctl-muted" style={{ fontSize: 12 }}>
            Sound is off — moments preview silently. Tick the box above to hear the cues.
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ssctl-btn" style={{ minHeight: 38 }} onClick={playMoment}>
            <Play size={15} /> Play moment
          </button>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 38 }} onClick={replay} disabled={!hasPlayed}>
            <Repeat size={15} /> Replay
          </button>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 38 }} onClick={soundOnly}>
            <Volume2 size={15} /> Play sound only
          </button>
          {cycling ? (
            <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 38 }} onClick={stopCycle}>
              <X size={15} /> Stop cycle
            </button>
          ) : (
            <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 38 }} onClick={cycleAll}>
              <FastForward size={15} /> Cycle all
            </button>
          )}
        </div>
      </div>

      {preview && createPortal(
        <div className={`liftoff-overlay liftoff-cat-${getTier(preview.tierId).category} ${preview.variant === 'down' ? 'liftoff-down' : ''}`} onClick={close}
          role="dialog" aria-modal="true" aria-label={`Preview: ${tierLabel(preview.tierId)}`}>
          {forceMotion && preview.variant !== 'down' && (
            <canvas ref={canvasRef} className="liftoff-canvas" aria-hidden="true" />
          )}
          <button className="liftoff-close" onClick={close} aria-label="Close preview"><X size={20} /></button>
          <span style={{
            position: 'absolute', top: 20, left: 20, zIndex: 3,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, padding: '5px 12px',
          }}>Preview — no data is changed</span>
          <div className="liftoff-stage" onClick={(e) => e.stopPropagation()}>
            <RankMomentCard
              variant={preview.variant}
              tierId={preview.tierId}
              fromTierId={preview.fromTierId}
              score={preview.score}
              city=""
              revealed={preview.revealed}
              stillMode={preview.still}
              onContinue={close}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
