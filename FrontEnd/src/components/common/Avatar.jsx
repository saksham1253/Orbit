const SIZES = {
  xs: { box: 'w-6 h-6',   text: 'text-[9px]'  },
  sm: { box: 'w-8 h-8',   text: 'text-[10px]' },
  md: { box: 'w-10 h-10', text: 'text-xs'      },
  lg: { box: 'w-14 h-14', text: 'text-sm'      },
  xl: { box: 'w-20 h-20', text: 'text-lg'      },
};

// Expanded gradient palette for unique user colors (12 variations)
const GRADIENTS = [
  'linear-gradient(135deg,#00c6ff,#0072ff)',  // Cyan to Blue
  'linear-gradient(135deg,#ff0076,#7c3aed)',  // Pink to Purple
  'linear-gradient(135deg,#ffb800,#ff6b00)',  // Amber to Orange
  'linear-gradient(135deg,#00e5a0,#00c6b3)',  // Green to Teal
  'linear-gradient(135deg,#7c3aed,#a855f7)',  // Purple to Light Purple
  'linear-gradient(135deg,#ff4b4b,#ff0076)',  // Red to Pink
  'linear-gradient(135deg,#0072ff,#7c3aed)',  // Blue to Purple
  'linear-gradient(135deg,#00e5a0,#ffb800)',  // Green to Amber
  'linear-gradient(135deg,#ff6b00,#ff0076)',  // Orange to Pink
  'linear-gradient(135deg,#00c6ff,#00e5a0)',  // Cyan to Green
  'linear-gradient(135deg,#a855f7,#ff0076)',  // Light Purple to Pink
  'linear-gradient(135deg,#ffb800,#00c6ff)',  // Amber to Cyan
];

// Generate deterministic color based on userId or name
const gradientFor = (identifier) => {
  if (!identifier) return GRADIENTS[0];
  
  // Create hash from string for consistent color assignment
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

const Avatar = ({ name, url, size = 'md', className = '', userId = null }) => {
  const { box, text } = SIZES[size] || SIZES.md;

  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Use userId for color if available, fallback to name
  const colorKey = userId || name || 'default';

  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0 ${box} ${text} ${className}`}
      style={url ? {} : { background: gradientFor(colorKey), color: '#fff' }}
    >
      {url ? (
        <img src={url} alt={name || 'avatar'} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span style={{ lineHeight: 1 }}>{initials}</span>
      )}
    </div>
  );
};

export default Avatar;
