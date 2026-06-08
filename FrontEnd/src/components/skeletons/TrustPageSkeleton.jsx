/**
 * TrustPageSkeleton — mirrors TrustScore.jsx layout exactly:
 *
 * TOP ROW (md:col-span-2 + md:col-span-3):
 *   LEFT: circular gauge ring + label pill + 2 stat mini-boxes side by side
 *   RIGHT: Score Breakdown header + 4 factor progress bars
 *
 * BOTTOM: Recent Reviews card with 3 review rows
 */
import { SkelBox, SkelCircle, SkelPill, SkelRing, SkelProgressBar } from '../ui/SkeletonPrimitives';

/* ── Single factor bar row ─────────────────────────────── */
const FactorRowSkeleton = ({ color, pct }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SkelCircle size={14} />
        <SkelBox w={110} h={11} r={4} />
      </div>
      <SkelBox w={38} h={11} r={4} />
    </div>
    <SkelProgressBar color={color} pct={pct} />
  </div>
);

/* ── Single review row ─────────────────────────────────── */
const ReviewRowSkeleton = () => (
  <div
    style={{
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}
  >
    <SkelCircle size={38} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Name + stars + timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkelBox w={130} h={12} r={4} />
          {/* 5 star dots */}
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkelBox key={i} w={12} h={12} r={3} />
            ))}
          </div>
        </div>
        <SkelBox w={90} h={10} r={4} />
      </div>
      {/* Review quote */}
      <SkelBox w="68%" h={10} r={4} />
    </div>
  </div>
);

/* ── Stat mini-box (avg rating / reviews count) ─────────── */
const StatBoxSkeleton = () => (
  <div
    style={{
      flex: 1,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 7,
    }}
  >
    {/* Stars row / icon */}
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkelBox key={i} w={12} h={12} r={3} />
      ))}
    </div>
    <SkelBox w={36} h={18} r={5} />
    <SkelBox w={55} h={10} r={4} />
  </div>
);

/* ── Main export ────────────────────────────────────────── */
export const TrustPageSkeleton = () => (
  <div className="max-w-4xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

    {/* Page title row */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkelBox w={240} h={24} r={6} />
      <SkelBox w={320} h={11} r={4} />
    </div>

    {/* TOP ROW: matches `grid grid-cols-1 md:grid-cols-5 gap-5` */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

      {/* LEFT col — gauge card (md:col-span-2) */}
      <div
        style={{
          gridColumn: 'span 2',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        {/* Circular gauge */}
        <SkelRing size={136} stroke={11} />
        {/* "Good" label pill */}
        <SkelPill w={76} h={28} />
        {/* Two stat boxes side by side */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <StatBoxSkeleton />
          <StatBoxSkeleton />
        </div>
      </div>

      {/* RIGHT col — Score breakdown (md:col-span-3) */}
      <div
        style={{
          gridColumn: 'span 3',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkelCircle size={18} />
          <SkelBox w={150} h={14} r={4} />
        </div>

        {/* 4 factor rows — colors match real bars */}
        <FactorRowSkeleton color="#ffb800" pct={80} />   {/* Rating — yellow   */}
        <FactorRowSkeleton color="#a855f7" pct={25} />   {/* Experience — purple*/}
        <FactorRowSkeleton color="#00c6ff" pct={5}  />   {/* Account Age — cyan */}
        <FactorRowSkeleton color="#00e5a0" pct={35} />   {/* Activity — green   */}
      </div>
    </div>

    {/* BOTTOM — Recent Reviews card */}
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <SkelCircle size={18} />
        <SkelBox w={140} h={14} r={4} />
      </div>

      {/* 3 review rows */}
      <ReviewRowSkeleton />
      <ReviewRowSkeleton />
      <ReviewRowSkeleton />
    </div>
  </div>
);
