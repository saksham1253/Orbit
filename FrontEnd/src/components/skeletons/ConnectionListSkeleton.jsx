/**
 * ConnectionListSkeleton — mirrors the ConnectionCard used in Connections.jsx.
 * Real layout: skill-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4
 *   [large avatar] | name + trust | skill text | timestamp
 *   [Action buttons]
 */
import { SkelBox, SkelCircle, SkelPill } from '../ui/SkeletonPrimitives';

const ConnectionItemSkeleton = () => (
  <div className="skill-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    {/* Left: Avatar + Info */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
      {/* Large avatar with online dot placeholder */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <SkelCircle size={48} />
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--skeleton-mid)',
            border: '3px solid var(--bg-app)',
          }}
        />
      </div>
      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SkelBox w={140} h={14} r={4} />
          <SkelPill w={40} h={16} />
        </div>
        <SkelBox w={200} h={10} r={4} />
        <SkelBox w={110} h={8} r={3} />
      </div>
    </div>

    {/* Right: Action Buttons */}
    <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
      <SkelBox w={80} h={36} r={12} />
      <SkelBox w={64} h={36} r={12} />
      <SkelBox w={80} h={36} r={12} style={{ background: 'linear-gradient(135deg, rgba(0,198,255,0.15), rgba(0,114,255,0.15))' }} />
    </div>
  </div>
);

const ConnectionTabsSkeleton = () => (
  <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
    <SkelPill w={120} h={36} />
    <SkelPill w={140} h={36} />
    <SkelPill w={130} h={36} />
    <SkelPill w={100} h={36} />
  </div>
);

export const ConnectionListSkeleton = ({ count = 3 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <ConnectionTabsSkeleton />
    {Array.from({ length: count }).map((_, i) => (
      <ConnectionItemSkeleton key={i} />
    ))}
  </div>
);
