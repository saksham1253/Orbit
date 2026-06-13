import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, MapPin, Globe, Star, Mail, Link as LinkIcon, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import Avatar from '../components/common/Avatar';
import { ProfileHeaderSkeleton, SkillGridSkeleton } from '../components/skeletons';
import ErrorState from '../components/common/ErrorState';
import CosmicProfileCard from '../cosmic/CosmicProfileCard';

const PublicProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/user/${userId}`).then(res => res.data),
    retry: 1,
  });

  const { data: skills = [], isLoading: isLoadingSkills } = useQuery({
    queryKey: ['skills', 'user', userId],
    queryFn: () => api.get('/skills/all').then(res => res.data.filter(s => s.userId?._id === userId || s.userId === userId)),
    enabled: !!user,
  });

  const { data: ratingsData, isLoading: isLoadingRatings, isError: isErrorRatings, refetch: refetchRatings } = useQuery({
    queryKey: ['ratings', userId],
    queryFn: () => api.get(`/trust/ratings/${userId}`).then(res => res.data),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <ProfileHeaderSkeleton />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-4xl mx-auto space-y-7">
        <ErrorState message="User not found or failed to load profile." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-7">
      <Helmet>
        <title>{user.name}'s Profile | SkillSwap</title>
        <meta name="description" content={`Check out ${user.name}'s profile on SkillSwap.`} />
      </Helmet>

      {/* Header Profile Card */}
      <motion.div
        className="card-glass p-6 sm:p-10 relative overflow-hidden flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Avatar name={user.name} url={user.avatar} size="xxl" userId={user._id} />

        <div className="flex-1 text-center md:text-left space-y-4 w-full">
          <div>
            <h1 className="text-3xl font-display font-bold text-text-primary flex items-center justify-center md:justify-start gap-2">
              {user.name}
              {user.trustScore >= 80 && (
                <ShieldCheck className="text-accent" size={20} title="Highly Trusted" />
              )}
            </h1>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-text-secondary text-sm">
              {user.location && (
                <span className="flex items-center gap-1.5"><MapPin size={14} /> {user.location}</span>
              )}
              {user.languages?.length > 0 && (
                <span className="flex items-center gap-1.5"><Globe size={14} /> {user.languages.join(', ')}</span>
              )}
              {user.createdAt && !isNaN(new Date(user.createdAt).getTime()) && (
                <span className="flex items-center gap-1.5"><Calendar size={14} /> Joined {format(new Date(user.createdAt), 'MMM yyyy')}</span>
              )}
            </div>
          </div>

          <p className="text-text-secondary leading-relaxed max-w-2xl mx-auto md:mx-0">
            {user.bio || "This user hasn't written a bio yet."}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                 style={{ background: 'rgba(255,184,0,0.1)', color: '#ffb800', border: '1px solid rgba(255,184,0,0.2)' }}>
              <Star size={16} fill="currentColor" /> {user.trustScore} Trust Score
            </div>
            {user.totalRatings > 0 && (
              <button
                onClick={() => document.getElementById('ratings-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm text-text-secondary hover:text-white/80 transition-colors underline decoration-white/30 hover:decoration-white/60"
              >
                {user.totalRatings} {user.totalRatings === 1 ? 'review' : 'reviews'}
              </button>
            )}
          </div>
          
          {/* Social Links */}
          {user.socialLinks && (user.socialLinks.github || user.socialLinks.linkedin || user.socialLinks.website) && (
            <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
              {user.socialLinks?.github && (
                <a href={user.socialLinks.github.startsWith('http') ? user.socialLinks.github : `https://${user.socialLinks.github}`} target="_blank" rel="noopener noreferrer" 
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.4 13.4 0 0 0-7 0C6.2 3.4 5 3.8 5 3.8a5.5 5.5 0 0 0-.1 3.8A5.5 5.5 0 0 0 3.4 11.4c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/><path d="M9 20a5.5 5.5 0 0 1-5-2.5"/></svg>
                </a>
              )}
              {user.socialLinks?.linkedin && (
                <a href={user.socialLinks.linkedin.startsWith('http') ? user.socialLinks.linkedin : `https://${user.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" 
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#0077b5' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
              )}
              {user.socialLinks.website && (
                <a href={user.socialLinks.website.startsWith('http') ? user.socialLinks.website : `https://${user.socialLinks.website}`} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent transition-colors">
                  <LinkIcon size={18} />
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Cosmic standing — additive, sits below the trust header card */}
      <CosmicProfileCard userId={user._id} />

      {/* Skills Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-display font-semibold">Skills</h2>
        {isLoadingSkills ? (
          <SkillGridSkeleton count={2} />
        ) : skills.length === 0 ? (
          <div className="card-glass p-8 text-center text-text-muted">
            This user hasn't posted any skills yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map(skill => (
              <div key={skill._id} className="card-glass p-5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="pill-offer">{skill.skillOffered}</span>
                  <span className="text-text-muted font-light">⇄</span>
                  <span className="pill-want">{skill.skillWanted}</span>
                </div>
                {skill.description && (
                  <p className="text-sm text-text-secondary">{skill.description}</p>
                )}
                <div className="flex items-center justify-between pt-2">
                   <span className="text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-surface text-text-muted border border-border-subtle">
                     {skill.level}
                   </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Ratings & Reviews Section — always visible with proper states */}
      <div id="ratings-section" className="space-y-4 scroll-mt-24">
        <h2 className="text-xl font-display font-semibold">Reviews &amp; Ratings</h2>
        {isLoadingRatings ? (
          <SkillGridSkeleton count={2} />
        ) : isErrorRatings ? (
          <div className="card-glass p-8 text-center space-y-3">
            <p className="text-sm text-danger">Failed to load reviews.</p>
            <button
              onClick={() => refetchRatings()}
              className="text-xs font-medium text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !ratingsData?.ratings?.length ? (
          <div className="card-glass p-8 text-center text-text-muted">
            No reviews yet
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ratings summary */}
            <div className="card-glass p-6 border border-white/5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-amber flex items-center justify-center gap-2">
                    <Star size={40} fill="currentColor" className="text-amber" />
                    {ratingsData.user?.trustScore ?? user.trustScore}
                  </div>
                  <p className="text-sm text-text-muted mt-1">
                    {ratingsData.ratings.length} {ratingsData.ratings.length === 1 ? 'review' : 'reviews'}
                  </p>
                </div>
                
                {/* Star breakdown */}
                <div className="flex-1 space-y-2 w-full">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = ratingsData.ratings.filter(r => r.score === stars).length;
                    const total = ratingsData.ratings.length;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="text-xs text-text-muted w-8">{stars} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`, 
                              background: 'linear-gradient(90deg, #ffb800, #ff8c00)' 
                            }}
                          />
                        </div>
                        <span className="text-xs text-text-muted w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Individual reviews */}
            <div className="space-y-3">
              {ratingsData.ratings.slice(0, 5).map(rating => (
                <div key={rating._id} className="card-glass p-5 border border-white/5">
                  <div className="flex items-start gap-4">
                    <Avatar 
                      name={rating.fromUser?.name || 'Anonymous'} 
                      url={rating.fromUser?.avatar} 
                      size="md" 
                      userId={rating.fromUser?._id}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-semibold text-text-primary text-sm">
                          {rating.fromUser?.name || 'Anonymous'}
                        </h4>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={12} 
                              fill={i < rating.score ? '#ffb800' : 'none'}
                              className={i < rating.score ? 'text-amber' : 'text-white/20'}
                            />
                          ))}
                        </div>
                      </div>
                      {rating.review && (
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">{rating.review}</p>
                      )}
                      {rating.skillContext && (
                        <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
                          <span className="opacity-50">•</span> {rating.skillContext}
                        </p>
                      )}
                      <p className="text-xs text-white/25 mt-2">
                        {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {ratingsData.ratings.length > 5 && (
                <p className="text-center text-sm text-text-muted py-2">
                  Showing 5 of {ratingsData.ratings.length} reviews
                </p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default PublicProfile;
