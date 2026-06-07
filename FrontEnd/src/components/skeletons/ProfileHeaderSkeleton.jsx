/**
 * ProfileHeaderSkeleton — mirrors the top header of Profile.jsx / PublicProfile.jsx
 * Real layout: glass-card p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6
 *   [Large avatar] | name/bio text lines | [Edit / Share buttons]
 */
import { SkelBox, SkelCircle } from '../ui/SkeletonPrimitives';

export const ProfileHeaderSkeleton = () => (
  <div
    className="glass-card"
    style={{
      padding: 32,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 24,
    }}
  >
    <SkelCircle size={96} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <SkelBox w={190} h={28} r={6} />
      <SkelBox w={120} h={14} r={4} />
      <SkelBox w="100%" h={12} r={4} style={{ maxWidth: 440 }} />
      <SkelBox w="75%" h={12} r={4} style={{ maxWidth: 380 }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <SkelBox w={110} h={36} r={12} style={{ background: 'linear-gradient(135deg, rgba(0,198,255,0.15), rgba(0,114,255,0.15))' }} />
        <SkelBox w={96} h={36} r={12} />
      </div>
    </div>
  </div>
);
