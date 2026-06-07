/**
 * SkillCardSkeleton — mirrors SkillCard exactly:
 *   avatar | name/location | trust-badge
 *   pill offer ⇄ pill want
 *   2 description lines
 *   level-badge + time
 *   Ratings btn + Connect btn
 *
 * Grid: 3 cols desktop · 2 cols tablet · 1 col mobile
 * (matches `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5` used by BrowseSkills, Matches, MySkills)
 */
import { SkelBox, SkelCircle, SkelPill } from '../ui/SkeletonPrimitives';

export const SkillCardSkeleton = () => (
  <div
    className="skill-card"
    style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 220 }}
  >
    {/* Row 1: avatar + name/location + trust badge */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <SkelCircle size={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <SkelBox w="55%" h={13} r={5} />
          <div style={{ display: 'flex', gap: 8 }}>
            <SkelBox w="38%" h={10} r={4} />
            <SkelBox w="26%" h={10} r={4} />
          </div>
        </div>
      </div>
      {/* Trust score badge */}
      <SkelPill w={44} h={22} />
    </div>

    {/* Row 2: cyan pill ⇄ pink pill */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <SkelPill w={112} h={26} />
      <SkelBox w={12} h={10} r={2} style={{ opacity: 0.3 }} />
      <SkelPill w={92} h={26} />
    </div>

    {/* Row 3: description lines */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <SkelBox w="100%" h={10} r={4} />
      <SkelBox w="78%" h={10} r={4} />
    </div>

    {/* Row 4: level badge + time ago */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
      <SkelPill w={90} h={22} />
      <SkelBox w={80} h={10} r={4} />
    </div>

    {/* Row 5: Ratings btn + Connect btn */}
    <div style={{ display: 'flex', gap: 10 }}>
      <SkelBox w={88} h={36} r={10} />
      <SkelBox h={36} r={10} style={{ flex: 1 }} />
    </div>
  </div>
);

/**
 * SkillGridSkeleton — same grid wrapper as BrowseSkills / Matches / MySkills
 */
export const SkillGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <SkillCardSkeleton key={i} />
    ))}
  </div>
);
