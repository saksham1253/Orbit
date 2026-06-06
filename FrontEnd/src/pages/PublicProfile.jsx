import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, MapPin, Globe, Star, Mail, Github, Linkedin, Link as LinkIcon, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';
import Avatar from '../components/common/Avatar';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ErrorState from '../components/common/ErrorState';

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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-7">
        <LoadingSkeleton type="profile" />
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
            <h1 className="text-3xl font-display font-bold text-white flex items-center justify-center md:justify-start gap-2">
              {user.name}
              {user.trustScore >= 80 && (
                <ShieldCheck className="text-accent" size={20} title="Highly Trusted" />
              )}
            </h1>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-white/50 text-sm">
              {user.location && (
                <span className="flex items-center gap-1.5"><MapPin size={14} /> {user.location}</span>
              )}
              {user.languages?.length > 0 && (
                <span className="flex items-center gap-1.5"><Globe size={14} /> {user.languages.join(', ')}</span>
              )}
              {user.createdAt && (
                <span className="flex items-center gap-1.5"><Calendar size={14} /> Joined {format(new Date(user.createdAt), 'MMM yyyy')}</span>
              )}
            </div>
          </div>

          <p className="text-white/70 leading-relaxed max-w-2xl mx-auto md:mx-0">
            {user.bio || "This user hasn't written a bio yet."}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                 style={{ background: 'rgba(255,184,0,0.1)', color: '#ffb800', border: '1px solid rgba(255,184,0,0.2)' }}>
              <Star size={16} fill="currentColor" /> {user.trustScore} Trust Score
            </div>
            {user.totalRatings > 0 && (
              <span className="text-sm text-white/40">({user.totalRatings} reviews)</span>
            )}
          </div>
          
          {/* Social Links */}
          {user.socialLinks && (user.socialLinks.github || user.socialLinks.linkedin || user.socialLinks.website) && (
            <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
              {user.socialLinks.github && (
                <a href={user.socialLinks.github.startsWith('http') ? user.socialLinks.github : `https://${user.socialLinks.github}`} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-colors">
                  <Github size={18} />
                </a>
              )}
              {user.socialLinks.linkedin && (
                <a href={user.socialLinks.linkedin.startsWith('http') ? user.socialLinks.linkedin : `https://${user.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-[#0077b5] transition-colors">
                  <Linkedin size={18} />
                </a>
              )}
              {user.socialLinks.website && (
                <a href={user.socialLinks.website.startsWith('http') ? user.socialLinks.website : `https://${user.socialLinks.website}`} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-accent transition-colors">
                  <LinkIcon size={18} />
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Skills Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-display font-semibold">Skills</h2>
        {isLoadingSkills ? (
          <LoadingSkeleton type="card" count={2} />
        ) : skills.length === 0 ? (
          <div className="card-glass p-8 text-center text-white/40">
            This user hasn't posted any skills yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map(skill => (
              <div key={skill._id} className="card-glass p-5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="pill-offer">{skill.skillOffered}</span>
                  <span className="text-white/30 font-light">⇄</span>
                  <span className="pill-want">{skill.skillWanted}</span>
                </div>
                {skill.description && (
                  <p className="text-sm text-white/50">{skill.description}</p>
                )}
                <div className="flex items-center justify-between pt-2">
                   <span className="text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-white/5 text-white/40 border border-white/10">
                     {skill.level}
                   </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default PublicProfile;
