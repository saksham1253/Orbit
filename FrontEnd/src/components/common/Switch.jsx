/**
 * Switch — one reusable, accessible toggle row for the settings page (v6 §4).
 * Unifies the previously ad-hoc Dark Mode / UI Sounds / Ambient Music toggles
 * into a single component: label + description on the left, track+thumb on the
 * right. Behavior is delegated entirely to `onChange` — this is presentation
 * only, so wiring (theme store, sound manager) is unchanged at the call sites.
 *
 * Accessibility: real `role="switch"` + `aria-checked`, Space/Enter toggle,
 * visible focus ring, ≥44px tap target. On = brand accent (via the existing
 * --toggle-* tokens, so it stays correct in both themes); off = muted track.
 */
import { motion } from 'framer-motion';

export default function Switch({
  checked,
  onChange,
  label,
  description,
  icon = null,          // optional leading icon (e.g. <Moon/> / <Sun/>)
  delay = 0,
  id,
}) {
  const descId = description && id ? `${id}-desc` : undefined;

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      role="switch"
      tabIndex={0}
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-describedby={descId}
      onClick={onChange}
      onKeyDown={handleKeyDown}
      className={`w-full flex items-center justify-between gap-4 px-6 py-4 min-h-[44px] rounded-xl border transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
        checked ? 'bg-accent/10 border-accent/30' : 'bg-surface border-border-subtle'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="flex-none">{icon}</span>}
        <div className="text-left min-w-0">
          <div className="text-sm font-semibold text-text-primary">{label}</div>
          {description && (
            <div id={descId} className="text-xs text-text-muted">{description}</div>
          )}
        </div>
      </div>

      {/* Track + thumb (≥44px hit area provided by the row; thumb is visual). */}
      <div
        aria-hidden="true"
        className="flex-none w-12 h-6 rounded-full transition-all relative border"
        style={{
          background: checked ? 'var(--toggle-on-bg)' : 'var(--toggle-off-bg)',
          borderColor: checked ? 'transparent' : 'var(--toggle-off-border)',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all"
          style={{ left: checked ? '26px' : '2px' }}
        />
      </div>
    </motion.div>
  );
}
