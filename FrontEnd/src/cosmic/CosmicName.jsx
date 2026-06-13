/**
 * CosmicName — renders a display name with the tier name-glow perk (v2 §8).
 * Only Supernova+ glow; below that it's a plain name (no class). `exploring`
 * amplifies the Quasar legendary glow (e.g. when their profile is opened).
 */
import './CosmicName.css';

export default function CosmicName({ glow, exploring = false, className = '', children }) {
  const glowClass = glow ? `cname cname--${glow}${glow === 'quasar' && exploring ? ' is-exploring' : ''}` : '';
  return <span className={`${glowClass} ${className}`.trim()}>{children}</span>;
}
