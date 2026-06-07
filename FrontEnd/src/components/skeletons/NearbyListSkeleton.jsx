/**
 * NearbyListSkeleton — mirrors the nearby skill list sidebar in NearbyMap.jsx.
 * Real layout per item (skill-card p-5 flex flex-col sm:flex-row):
 *   [40px avatar] | name + distance/trust text | [pill-offer ⇄ pill-want]
 */
import { SkelBox, SkelCircle, SkelPill } from '../ui/SkeletonPrimitives';

const NearbyItemSkeleton = () => (
  <div
    className="skill-card"
    style={{
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}
  >
    {/* Left: avatar + name/distance */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <SkelCircle size={40} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkelBox w={130} h={12} r={5} />
        <SkelBox w={90} h={10} r={4} />
      </div>
    </div>
    {/* Right: pill-offer ⇄ pill-want */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <SkelPill w={88} h={24} />
      <SkelBox w={14} h={10} r={2} style={{ opacity: 0.3 }} />
      <SkelPill w={76} h={24} />
    </div>
  </div>
);

export const NearbyListSkeleton = ({ count = 4 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <NearbyItemSkeleton key={i} />
    ))}
  </div>
);
