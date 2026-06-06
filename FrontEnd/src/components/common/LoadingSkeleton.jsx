const SkeletonBox = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

const CardSkeleton = () => (
  <div className="p-5 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
    <div className="flex items-center gap-3">
      <SkeletonBox className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-3.5 w-2/5" />
        <SkeletonBox className="h-3 w-1/4" />
      </div>
    </div>
    <div className="space-y-2">
      <SkeletonBox className="h-3 w-full" />
      <SkeletonBox className="h-3 w-4/5" />
    </div>
    <div className="flex gap-2 pt-1">
      <SkeletonBox className="h-8 w-24 rounded-xl" />
      <SkeletonBox className="h-8 w-20 rounded-xl" />
    </div>
  </div>
);

const TextSkeleton = () => (
  <div className="space-y-2">
    <SkeletonBox className="h-3.5 w-full" />
    <SkeletonBox className="h-3.5 w-3/4" />
  </div>
);

const LoadingSkeleton = ({ count = 1, type = 'card' }) => (
  <div className={type === 'card' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" : "space-y-4"}>
    {Array.from({ length: count }).map((_, i) =>
      type === 'card' ? <CardSkeleton key={i} /> : <TextSkeleton key={i} />
    )}
  </div>
);

export default LoadingSkeleton;
