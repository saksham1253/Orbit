import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import api from '../services/api';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import Avatar from '../components/common/Avatar';
import { Star, ShieldAlert, ShieldCheck, TrendingUp, Activity, Clock, Award } from 'lucide-react';

/* ── SVG ring gauge ── */
const ScoreRing = ({ score = 0 }) => {
  const size   = 180;
  const stroke = 12;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.max(0, Math.min(100, score)) / 100;
  const dash   = pct * circ;
  const gap    = circ - dash;

  const color  = score >= 70 ? '#00e5a0' : score >= 40 ? '#ffb800' : '#ff4b4b';
  const glow   = score >= 70 ? 'rgba(0,229,160,0.5)' : score >= 40 ? 'rgba(255,184,0,0.5)' : 'rgba(255,75,75,0.5)';
  const label  = score >= 70 ? 'Excellent' : score >= 40 ? 'Good' : 'Needs Work';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <filter id="ring-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={color} />
              <stop offset="100%" stopColor={score >= 70 ? '#00c6ff' : score >= 40 ? '#ff8c00' : '#ff0076'} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          {/* Filled arc */}
          {dash > 0 && (
            <circle cx={size/2} cy={size/2} r={r} fill="none"
              stroke="url(#ring-grad)" strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              style={{ filter: `drop-shadow(0 0 8px ${glow})`, transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
            />
          )}
        </svg>

        {/* Centre content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-display font-bold tabular-nums" style={{ color }}>{Math.round(score)}</span>
          <span className="text-xs font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>/100</span>
        </div>
      </div>

      {/* Label pill */}
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
        style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
        {label}
      </div>
    </div>
  );
};

/* ── Factor bar ── */
const FactorBar = ({ label, value, max, color, icon: Icon, delay }) => {
  const pct = Math.round((value / max) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="space-y-2"
    >
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-2 text-sm text-white/60">
          <Icon size={13} style={{ color }} /> {label}
        </span>
        <span className="text-sm font-bold" style={{ color }}>
          {value}<span className="text-white/25 font-normal">/{max}</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: `linear-gradient(90deg, ${color}, ${color}99)`, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </motion.div>
  );
};

/* ── Review card ── */
const ReviewCard = ({ r, idx }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.06, duration: 0.35 }}
    className="p-4 rounded-xl flex gap-4"
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    <div className="flex-shrink-0 mt-0.5">
      <Avatar name={r.fromUser?.name || '?'} url={r.fromUser?.avatar} size="md" userId={r.fromUser?._id} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">{r.fromUser?.name || 'Anonymous'}</span>
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={11} fill={i < r.score ? '#ffb800' : 'transparent'}
                style={{ color: i < r.score ? '#ffb800' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
        <span className="text-xs text-white/30 flex-shrink-0">
          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
        </span>
      </div>
      {r.review && <p className="text-sm text-white/55 italic">"{r.review}"</p>}
    </div>
  </motion.div>
);

/* ── Main Page ── */
const TrustScore = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['trustScore'],
    queryFn: () => api.get('/trust/my-score').then(r => r.data),
  });

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <LoadingSkeleton count={1} type="card" />
      <LoadingSkeleton count={1} type="card" />
    </div>
  );

  const { trustScore = 0, totalRatings = 0, averageRating = 0, isFlagged, flagReason, breakdown = {}, recentRatings = [] } = data || {};
  const bd = breakdown;

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <span style={{ background: 'linear-gradient(135deg,#00c6ff,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            Trust & Reputation
          </span>
        </h1>
        <p className="text-white/40 mt-1 text-sm">Your community standing based on interactions and feedback.</p>
      </div>

      {/* Flagged warning */}
      {isFlagged && (
        <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.3)' }}>
          <ShieldAlert className="text-danger flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-danger text-sm">Account Flagged</p>
            <p className="text-white/50 text-xs mt-0.5">{flagReason || 'Safety policy violation detected.'}</p>
          </div>
        </div>
      )}

      {/* ── Top row: Ring + Factors ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

        {/* Score ring card */}
        <div className="md:col-span-2 flex flex-col items-center justify-center gap-6 p-8 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ScoreRing score={trustScore} />
          {/* Quick stats row */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="flex flex-col items-center p-3 rounded-xl" style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)' }}>
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < Math.round(averageRating) ? '#ffb800' : 'transparent'} style={{ color: '#ffb800' }} />)}
              </div>
              <span className="text-lg font-bold text-amber">{averageRating?.toFixed(1) || '0.0'}</span>
              <span className="text-[10px] text-white/35">avg rating</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl" style={{ background: 'rgba(0,198,255,0.08)', border: '1px solid rgba(0,198,255,0.2)' }}>
              <Award size={16} className="text-accent mb-0.5" />
              <span className="text-lg font-bold text-accent">{totalRatings}</span>
              <span className="text-[10px] text-white/35">reviews</span>
            </div>
          </div>
        </div>

        {/* Factors breakdown */}
        <div className="md:col-span-3 p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
            <ShieldCheck size={16} className="text-accent" /> Score Breakdown
          </h3>
          <FactorBar label="Rating Score"    value={bd.ratingScore    ?? 0} max={40} color="#ffb800" icon={Star}       delay={0}    />
          <FactorBar label="Experience"      value={bd.experienceScore ?? 0} max={20} color="#a855f7" icon={Award}      delay={0.07} />
          <FactorBar label="Account Age"     value={bd.ageScore        ?? 0} max={20} color="#00c6ff" icon={Clock}      delay={0.14} />
          <FactorBar label="Activity Score"  value={bd.activityScore   ?? 0} max={20} color="#00e5a0" icon={Activity}   delay={0.21} />
        </div>
      </div>

      {/* ── Recent Reviews ── */}
      <div className="p-6 rounded-2xl space-y-4"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
          <TrendingUp size={16} className="text-secondary" /> Recent Reviews
        </h3>
        {recentRatings.length === 0 ? (
          <div className="py-10 text-center">
            <Star size={32} className="mx-auto text-white/10 mb-3" />
            <p className="text-white/35 text-sm">No reviews yet. Complete skill exchanges to receive feedback.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRatings.map((r, i) => <ReviewCard key={r._id} r={r} idx={i} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustScore;
