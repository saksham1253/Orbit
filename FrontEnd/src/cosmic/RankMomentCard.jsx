/**
 * RankMomentCard — the presentational rank-moment card (v7 §6).
 *
 * One component renders every moment so the live LiftoffOverlay and the admin
 * Moment Lab show EXACTLY the same thing (no drift). Variants:
 *   - 'up'     bright, hopeful rank-up (category jumps read as a grand "Liftoff")
 *   - 'down'   dignified, encouraging Descent (never shaming, per v4 §5)
 *   - 'quasar' the spectacular secret tier
 *
 * Hierarchy (top→bottom): eyebrow → animated tier badge (front & centre) →
 * BIG tier name → short supporting line → CosmicScore → one primary action
 * (Continue) + a secondary Share. Reduced-motion / Animation-Speed 0 collapse
 * to a calm crossfade via `stillMode`.
 *
 * Pure render: no store access, no side effects — safe to mount anywhere.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Sparkles } from 'lucide-react';
import CosmicBadge from './CosmicBadge';
import { getTier } from './tiers';
import { momentCopy } from './momentCopy';

export default function RankMomentCard({
  variant = 'up',
  tierId,
  fromTierId = null,
  score = null,
  pointsToRecover = null,
  city = '',
  welcomeKind = null,
  revealed = true,
  stillMode = false,
  sharing = false,
  onShare,
  onContinue,
}) {
  const tier = getTier(tierId);
  const { eyebrow, support } = momentCopy({ variant, tierId, fromTierId, pointsToRecover, city, welcomeKind });

  return (
    <div className={`rmc rmc-${variant}`}>
      <AnimatePresence>
        {revealed && (
          <motion.div
            key="badge"
            initial={stillMode ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={stillMode
              ? { duration: 0.6 }
              : { type: 'spring', stiffness: 160, damping: 14, mass: 0.8 }}
            className="rmc-badge-wrap"
          >
            <div className={`rmc-badge-halo cb-halo-${tier.category}`}>
              <CosmicBadge tierId={tierId} size="full" className="rmc-badge" />
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
            className="rmc-text"
          >
            <div className="rmc-eyebrow">{eyebrow}</div>
            <h2 className="rmc-tier-name">{tier.displayName}</h2>
            <p className="rmc-support">{support}</p>
            {score != null && <div className="rmc-score">CosmicScore {score}</div>}

            <div className="rmc-actions">
              <button className="rmc-primary" onClick={onContinue}>
                <Sparkles size={15} /> Continue
              </button>
              {onShare && (
                <button className="rmc-secondary" onClick={onShare} disabled={sharing}>
                  <Share2 size={14} /> {sharing ? 'Preparing…' : 'Share your card'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
