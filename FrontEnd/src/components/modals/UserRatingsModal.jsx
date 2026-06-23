import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ShieldCheck, MessageSquare } from 'lucide-react';
import api from '../../services/api';
import Avatar from '../common/Avatar';
import { SkelBox, SkelCircle } from '../ui/SkeletonPrimitives';

/**
 * UserRatingsModal
 * Shows a user's trust score, average rating and all reviews.
 * Triggered from Browse Skills or incoming connection requests.
 */
const UserRatingsModal = ({ user, isOpen, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['user-ratings', user?._id],
    queryFn: () => api.get(`/trust/ratings/${user._id}`).then(r => r.data),
    enabled: !!user?._id && isOpen,
    staleTime: 60_000,
  });

  const ratings = data?.ratings || [];
  const profile = data?.user || user;
  const avg     = profile?.averageRating || 0;
  const total   = profile?.totalRatings || 0;
  const ts      = profile?.trustScore || 0;

  const tsColor = ts >= 70 ? '#00e5a0' : ts >= 40 ? '#ffb800' : '#ff4b4b';
  const tsBg    = ts >= 70 ? 'rgba(0,229,160,0.1)' : ts >= 40 ? 'rgba(255,184,0,0.1)' : 'rgba(255,75,75,0.1)';

  const starFill = (star, avg) => {
    if (star <= Math.floor(avg)) return '#ffb800';
    if (star - 1 < avg && avg < star) return '#ffb800'; // partial — just show filled
    return 'transparent';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ratings-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            key="ratings-modal-card"
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 24,
              width: '100%', maxWidth: 480,
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <Avatar name={profile?.name} url={profile?.avatar} size="xl" userId={profile?._id} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0 }}>
                  {profile?.name || 'User'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {/* Trust score badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: tsBg, border: `1px solid ${tsColor}40`, color: tsColor,
                  }}>
                    <ShieldCheck size={11} /> Trust {ts}
                  </span>
                  {/* Star average */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {[1,2,3,4,5].map(s => (
                      <Star
                        key={s}
                        size={14}
                        fill={s <= Math.round(avg) ? '#ffb800' : 'transparent'}
                        style={{ color: s <= Math.round(avg) ? '#ffb800' : 'var(--text-muted)' }}
                      />
                    ))}
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 4 }}>
                      {avg > 0 ? avg.toFixed(1) : '—'} ({total} review{total !== 1 ? 's' : ''})
                    </span>
                  </span>
                </div>
              </div>
              <button
                aria-label="Close ratings modal"
                onClick={onClose}
                style={{
                  background: 'var(--bg-surface-hover)', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0 0' }} />

            {/* Reviews list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 14, padding: '14px 16px',
                        display: 'flex', flexDirection: 'column', gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <SkelCircle size={28} />
                          <SkelBox w={100} h={12} r={4} />
                        </div>
                        <SkelBox w={60} h={10} r={4} />
                      </div>
                      <SkelBox w="80%" h={10} r={4} />
                    </div>
                  ))}
                </div>
              ) : ratings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <MessageSquare size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No reviews yet</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    This person hasn't received any ratings yet.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ratings.map((r, i) => (
                    <motion.div
                      key={r._id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 14, padding: '14px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={r.fromUser?.name || '?'} url={r.fromUser?.avatar} size="sm" userId={r.fromUser?._id} />
                          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>
                            {r.fromUser?.name || 'Anonymous'}
                          </span>
                        </div>
                        {/* Stars for this review */}
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1,2,3,4,5].map(s => (
                            <Star
                              key={s}
                              size={12}
                              fill={s <= r.score ? '#ffb800' : 'transparent'}
                              style={{ color: s <= r.score ? '#ffb800' : 'var(--text-muted)' }}
                            />
                          ))}
                        </div>
                      </div>
                      {r.review && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0, overflowWrap: 'anywhere' }}>
                          "{r.review}"
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserRatingsModal;
