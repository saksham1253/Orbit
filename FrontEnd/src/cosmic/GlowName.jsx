/**
 * GlowName — the ONE component for rendering any user's display name with their
 * equipped glow, so purchased name-glows (and their animations) are visible to
 * ALL viewers everywhere a name appears — not just on the owner's own profile.
 *
 * Priority:
 *   1. a PURCHASED shop glow (`orbit.cosmetics.nameGlow`, e.g. "glow_void") wins;
 *   2. else the auto-EARNED tier glow (`cosmic.nameGlowTier` = supernova/…);
 *   3. else a plain name.
 *
 * Pass a whole `user` object (leaderboard/browse/profile payloads) OR explicit
 * `nameGlowTier` / `cosmeticGlowKey`. All glow CSS is animated + reduced-motion
 * gated (cosmetics.css / CosmicName.css), so it renders identically for everyone.
 */
import CosmicName from './CosmicName';
import { glowClassFor } from './cosmetics';

export default function GlowName({
  user,
  name,
  nameGlowTier,
  cosmeticGlowKey,
  className = '',
  exploring = false,
  children,
}) {
  const label = children ?? name ?? user?.name ?? '';

  // 1) purchased shop glow wins
  const glowKey = cosmeticGlowKey ?? user?.orbit?.cosmetics?.nameGlow ?? null;
  const shopGlow = glowClassFor(glowKey);
  if (shopGlow) return <span className={`${shopGlow} ${className}`.trim()}>{label}</span>;

  // 2) earned tier glow (or 3) plain, both via CosmicName
  const tier = nameGlowTier ?? user?.cosmic?.nameGlowTier ?? null;
  return <CosmicName glow={tier} exploring={exploring} className={className}>{label}</CosmicName>;
}
