/**
 * ProfileHeaderSkeleton — mirrors the top header of Profile.jsx / PublicProfile.jsx
 * Real layout: glass-card p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6
 *   [Large avatar] | name/bio text lines | [Edit / Share buttons]
 */
import { SkelBox, SkelCircle } from '../ui/SkeletonPrimitives';

export const ProfileHeaderSkeleton = () => (
  <div className="flex flex-col gap-6">
    {/* Header Card */}
    <div className="glass-card p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
      <SkelCircle size={96} />
      <div className="flex-1 flex flex-col items-center sm:items-start gap-3 w-full">
        <SkelBox w={190} h={28} r={6} />
        <SkelBox w={120} h={14} r={4} />
        <SkelBox w="100%" h={12} r={4} style={{ maxWidth: 440 }} />
        <SkelBox w="75%" h={12} r={4} style={{ maxWidth: 380 }} />
        <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2">
          <SkelBox w={110} h={36} r={12} style={{ background: 'linear-gradient(135deg, rgba(0,198,255,0.15), rgba(0,114,255,0.15))' }} />
          <SkelBox w={96} h={36} r={12} />
        </div>
      </div>
    </div>

    {/* Body Card Skeleton */}
    <div className="glass-card p-6 sm:p-8 flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkelBox w="100%" h={48} r={12} />
        <SkelBox w="100%" h={48} r={12} />
        <SkelBox w="100%" h={48} r={12} />
        <SkelBox w="100%" h={48} r={12} />
      </div>
      <SkelBox w="100%" h={120} r={12} />
      <div className="flex flex-wrap gap-2">
        <SkelPill w={80} h={32} />
        <SkelPill w={100} h={32} />
        <SkelPill w={70} h={32} />
        <SkelPill w={90} h={32} />
      </div>
      <div className="flex justify-end mt-2">
        <SkelBox w={120} h={44} r={12} style={{ background: 'var(--accent-1)', opacity: 0.2 }} />
      </div>
    </div>
  </div>
);
