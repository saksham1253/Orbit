/**
 * ChatListSkeleton — mirrors ConversationList rows in ChatDrawer.jsx.
 * Real row: px-4 py-3.5, avatar + name/last-message + timestamp
 *
 * ChatMessagesSkeleton — mirrors ChatWindow messages in ChatDrawer.jsx.
 * Real messages: flex items-end gap-2, alternating me/other alignment.
 */
import { SkelBox, SkelCircle } from '../ui/SkeletonPrimitives';

/* ── Conversation list skeleton ───────────────────────── */
const ChatConvoRowSkeleton = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}
  >
    <SkelCircle size={42} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkelBox w="50%" h={12} r={4} />
        <SkelBox w={32} h={10} r={4} />
      </div>
      <SkelBox w="72%" h={10} r={4} />
    </div>
  </div>
);

export const ChatListSkeleton = ({ count = 5 }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {Array.from({ length: count }).map((_, i) => (
      <ChatConvoRowSkeleton key={i} />
    ))}
  </div>
);

/* ── Message bubbles skeleton ──────────────────────────── */
const MSG_PATTERN = [
  { me: false, w: 190 },
  { me: true,  w: 145 },
  { me: false, w: 230 },
  { me: true,  w: 165 },
  { me: false, w: 200 },
  { me: true,  w: 120 },
  { me: false, w: 175 },
];

export const ChatMessagesSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
    {MSG_PATTERN.map((m, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          flexDirection: m.me ? 'row-reverse' : 'row',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {!m.me && <SkelCircle size={28} />}
        <SkelBox
          w={m.w}
          h={38}
          r={0}
          style={{
            borderRadius: m.me ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          }}
        />
      </div>
    ))}
  </div>
);
