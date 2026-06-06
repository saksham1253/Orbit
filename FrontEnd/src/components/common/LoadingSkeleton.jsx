/* ─────────────────────────────────────────────────────────
   Skeleton primitive
───────────────────────────────────────────────────────── */
const S = ({ className = '', style = {} }) => (
  <div className={`skeleton rounded-lg ${className}`} style={style} />
);

/* ─────────────────────────────────────────────────────────
   SkillCardSkeleton — mirrors SkillCard exactly:
   avatar | name/location | trust-badge | pill offer ⇄ pill want |
   2 description lines | level-badge + time | action buttons
───────────────────────────────────────────────────────── */
const SkillCardSkeleton = () => (
  <div
    className="skill-card p-5 flex flex-col gap-4"
    style={{ minHeight: 220 }}
  >
    {/* Header row: avatar + name/location + trust badge */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        <S className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          {/* Name */}
          <S className="h-3.5 w-32" />
          {/* Location + language row */}
          <div className="flex gap-2">
            <S className="h-2.5 w-20" />
            <S className="h-2.5 w-14" />
          </div>
        </div>
      </div>
      {/* Trust score badge */}
      <S className="h-5 w-10 rounded-full flex-shrink-0" />
    </div>

    {/* Skill exchange pills: [offer] ⇄ [want] */}
    <div className="flex items-center gap-2">
      <S className="h-6 w-24 rounded-full" />
      <S className="h-4 w-4 rounded-sm opacity-30" />
      <S className="h-6 w-24 rounded-full" />
    </div>

    {/* Description: 2 lines */}
    <div className="space-y-2">
      <S className="h-2.5 w-full" />
      <S className="h-2.5 w-4/5" />
    </div>

    {/* Footer: level badge + timestamp */}
    <div className="flex items-center gap-3 mt-auto">
      <S className="h-5 w-20 rounded-full" />
      <S className="h-2.5 w-24" />
    </div>

    {/* Action buttons: Ratings + Connect */}
    <div className="flex gap-2">
      <S className="h-9 w-24 rounded-xl flex-shrink-0" />
      <S className="h-9 flex-1 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(0,198,255,0.15),rgba(0,114,255,0.15))' }} />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   ConnectionCardSkeleton — mirrors ConnectionCard exactly:
   large avatar + online dot | name + trust | skill text |
   timestamp | right-side action buttons
───────────────────────────────────────────────────────── */
const ConnectionCardSkeleton = () => (
  <div className="skill-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    {/* Left — avatar + info */}
    <div className="flex items-center gap-4 flex-1 min-w-0">
      {/* Large avatar with online dot placeholder */}
      <div className="relative flex-shrink-0">
        <S className="w-12 h-12 rounded-full" />
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full skeleton"
          style={{ borderRadius: '50%' }}
        />
      </div>
      <div className="space-y-2 flex-1 min-w-0">
        {/* Name + trust badge row */}
        <div className="flex items-center gap-2">
          <S className="h-4 w-36" />
          <S className="h-4 w-10 rounded-full" />
        </div>
        {/* Skill text */}
        <S className="h-3 w-52" />
        {/* Timestamp */}
        <S className="h-2.5 w-28" />
      </div>
    </div>

    {/* Right — action buttons */}
    <div className="flex gap-2 flex-shrink-0">
      <S className="h-9 w-20 rounded-xl" />
      <S className="h-9 w-16 rounded-xl" />
      <S className="h-9 w-20 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(0,198,255,0.15),rgba(0,114,255,0.15))' }} />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   ProfileSkeleton — for the full profile page header
───────────────────────────────────────────────────────── */
const ProfileSkeleton = () => (
  <div className="glass-card p-8 space-y-6">
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
      <S className="w-24 h-24 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-3 w-full">
        <S className="h-7 w-48" />
        <S className="h-4 w-32" />
        <S className="h-3 w-full max-w-md" />
        <S className="h-3 w-3/4 max-w-sm" />
        <div className="flex gap-3 pt-2">
          <S className="h-9 w-28 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(0,198,255,0.15),rgba(0,114,255,0.15))' }} />
          <S className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   TextSkeleton — simple text block placeholder
───────────────────────────────────────────────────────── */
const TextSkeleton = () => (
  <div className="space-y-2.5">
    <S className="h-3.5 w-full" />
    <S className="h-3.5 w-3/4" />
    <S className="h-3.5 w-5/6" />
  </div>
);

/* ─────────────────────────────────────────────────────────
   LoadingSkeleton — exported component
   type: 'card' | 'connection' | 'profile' | 'text'
───────────────────────────────────────────────────────── */
const LoadingSkeleton = ({ count = 1, type = 'card' }) => {
  if (type === 'profile') return <ProfileSkeleton />;

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: count }).map((_, i) => (
          <SkillCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (type === 'connection') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <ConnectionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // text
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <TextSkeleton key={i} />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
