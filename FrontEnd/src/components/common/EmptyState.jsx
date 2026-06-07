import { motion } from 'framer-motion';

/**
 * EmptyState — rendered when a list/grid has no items.
 *
 * @param {ReactNode} icon        Lucide icon element (e.g. <Users size={32} />)
 * @param {string}    title       Short headline
 * @param {string}    description Explanatory sentence
 * @param {string}    ctaLabel    CTA button label (optional)
 * @param {Function}  onCta       CTA click handler (optional)
 * @param {string}    accentColor Hex colour for the icon bg tint (default cyan)
 */
const EmptyState = ({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
  accentColor = '#00c6ff',
}) => {
  const tintRgba = `${accentColor}1a`; // ~10% opacity
  const borderRgba = `${accentColor}33`; // ~20% opacity

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px dashed ${borderRgba}`,
      }}
    >
      {/* Icon badge */}
      {icon && (
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
          style={{
            background: tintRgba,
            border: `1px solid ${borderRgba}`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
      )}

      <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>

      {description && (
        <p className="text-text-muted text-sm max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all btn-gradient"
        >
          {ctaLabel}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;
