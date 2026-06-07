/**
 * VideoCallHistorySkeleton — mirrors VideoCall.jsx call history rows.
 * Real row (skill-card p-4 flex items-center justify-between gap-4):
 *   [avatar] | name + status/duration | [timestamp + "Call Again" btn]
 */
import { SkelBox, SkelCircle } from '../ui/SkeletonPrimitives';

const CallHistoryRowSkeleton = () => (
  <div
    className="skill-card"
    style={{
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}
  >
    {/* Left: avatar + name + status */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <SkelCircle size={40} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkelBox w={130} h={13} r={5} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SkelCircle size={14} />
          <SkelBox w={80} h={10} r={4} />
        </div>
      </div>
    </div>
    {/* Right: timestamp + Call Again btn */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <SkelBox w={70} h={10} r={4} />
      <SkelBox w={90} h={30} r={10} />
    </div>
  </div>
);

export const VideoCallHistorySkeleton = ({ count = 4 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <CallHistoryRowSkeleton key={i} />
    ))}
  </div>
);
