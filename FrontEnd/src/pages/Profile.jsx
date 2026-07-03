import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { UserCircle, Shield, Save, Camera, Upload, X, Link as LinkIcon, Globe } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import Avatar from '../components/common/Avatar';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import { ProfileHeaderSkeleton } from '../components/skeletons';
import CosmicProfileCard from '../cosmic/CosmicProfileCard';
import { equippedFromUser } from '../cosmic/cosmetics';
import { InfoDot, ScoreExplainerBody } from '../cosmic/scoreInfo';
import { TRUST_TOOLTIP, TRUST_SCORE_INFO } from '../cosmic/scoreCopy';
import LanguageMultiSelect from '../components/common/LanguageMultiSelect';

const MAX_LANGUAGES = 5;

const PRESET_AVATARS = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
  '/avatars/avatar-6.svg',
];

const Profile = () => {
  const { user, setUser } = useAuthStore();
  const { addToast }      = useUIStore();
  const queryClient       = useQueryClient();
  const [langs, setLangs] = useState(['English']);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewTab, setReviewTab] = useState('received');
  const [showTrustInfo, setShowTrustInfo] = useState(false);
  const fileInputRef = useRef(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/user/profile').then(r => r.data),
  });

  const { data: receivedReviews } = useQuery({
    queryKey: ['reviews', 'received', user?._id],
    queryFn: () => api.get(`/trust/ratings/${user._id}`).then(r => r.data.ratings),
    enabled: !!user?._id,
  });

  const { data: givenReviews } = useQuery({
    queryKey: ['reviews', 'given'],
    queryFn: () => api.get('/trust/my-given').then(r => r.data.ratings),
  });

  const { register, handleSubmit, setValue } = useForm();

  useEffect(() => {
    if (profile) {
      setValue('name',     profile.name     || '');
      setValue('bio',      profile.bio      || '');
      setValue('location', profile.location || '');
      setValue('socialLinks.github', profile.socialLinks?.github || '');
      setValue('socialLinks.linkedin', profile.socialLinks?.linkedin || '');
      setValue('socialLinks.website', profile.socialLinks?.website || '');
      // Sync the language chips from the loaded profile (intentional one-time
      // hydration when the profile query resolves, not derived render state).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangs(profile.languages?.length ? profile.languages : ['English']);
    }
  }, [profile, setValue]);

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/user/profile', { ...data, languages: langs }),
    onSuccess: ({ data }) => {
      addToast('Profile saved!', 'success');
      setUser({ ...user, name: data.user?.name || user?.name });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['cosmic'] }); // refresh standing card (v7 §1)
    },
    onError: (e) => addToast(e.response?.data?.message || 'Save failed', 'error'),
  });

  // Upload custom avatar (Base64)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast('Please upload an image file', 'error');
      return;
    }

    // Validate file size (2MB max for base64 to avoid payload too large)
    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be less than 2MB', 'error');
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      
      try {
        const { data } = await api.put('/user/avatar', { avatar: base64String });
        
        // Update auth store with full user object from backend to ensure navbar updates
        if (data.user) {
          setUser(data.user);
        }
        
        addToast('Avatar uploaded!', 'success');
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setShowAvatarModal(false);
      } catch (err) {
        addToast(err.response?.data?.message || 'Upload failed', 'error');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Select preset avatar
  const selectPresetAvatar = async (avatarUrl) => {
    try {
      const { data } = await api.put('/user/avatar', { avatar: avatarUrl });
      
      // Update auth store with full user object from backend to ensure navbar updates
      if (data.user) {
        setUser(data.user);
      }
      
      addToast('Avatar updated!', 'success');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowAvatarModal(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed', 'error');
    }
  };

  // Remove avatar (use gradient)
  const removeAvatar = async () => {
    try {
      const { data } = await api.put('/user/avatar', { avatar: '' });
      
      // Update auth store with full user object from backend to ensure navbar updates
      if (data.user) {
        setUser(data.user);
      }
      
      addToast('Avatar removed', 'success');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowAvatarModal(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed', 'error');
    }
  };

  if (isLoading) return <ProfileHeaderSkeleton />;

  const trust = profile?.trustScore ?? 0;
  const trustColor = trust >= 70 ? '#00e5a0' : trust >= 40 ? '#ffb800' : '#ff4b4b';
  // Equipped Stardust-shop cosmetics (name glow + nebula background).
  const { glowClass, bgClass } = equippedFromUser(profile);

  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <Helmet>
        <title>Your Profile | Orbit</title>
        <meta name="description" content="Manage your Orbit profile, avatar, and personal details." />
        <meta property="og:title" content="Your Profile | Orbit" />
        <meta property="og:description" content="Customize your Orbit profile and connect with learners worldwide." />
        <meta property="og:image" content="https://react-skill-swap-fully-fledged.vercel.app/og-image.png" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/profile" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/profile" />
      </Helmet>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold"
          style={{ background: 'linear-gradient(135deg,#ffb800,#ff0076)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Profile Settings
        </h1>
        <p className="text-text-muted mt-1 text-sm">Your public persona on Orbit.</p>
      </div>

      {/* Avatar + meta card — shows the equipped nebula background if any */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-5 p-6 rounded-2xl overflow-hidden ${bgClass}`}
        style={{ background: bgClass ? undefined : 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="relative">
          <Avatar name={profile?.name || user?.name} size="xl" userId={profile?._id || user?._id} url={profile?.avatar} />
          <button
            onClick={() => setShowAvatarModal(true)}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:scale-110 transition-transform"
            style={{ boxShadow: '0 4px 12px rgba(0,198,255,0.4)' }}
          >
            <Camera size={14} className="text-text-primary" />
          </button>
        </div>
        <div className="min-w-0">
          <p className={`text-xl font-bold truncate ${glowClass || 'text-text-primary'}`}>{profile?.name || user?.name}</p>
          <p className={`text-sm truncate ${bgClass ? 'text-white/80' : 'text-text-muted'}`}>{profile?.email || user?.email}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield size={13} style={{ color: trustColor }} />
            <span className="text-xs font-semibold" style={{ color: trustColor }}>
              Trust Score: {trust}/100
            </span>
            <InfoDot label="What is Trust Score?">{TRUST_TOOLTIP}</InfoDot>
            <button type="button" onClick={() => setShowTrustInfo(true)}
              className="text-[11px] text-text-muted underline hover:text-text-secondary">
              How it works
            </button>
          </div>
        </div>
      </motion.div>

      {/* Cosmic standing — additive, sits beside the Trust score above */}
      {(profile?._id || user?._id) && (
        <CosmicProfileCard userId={profile?._id || user?._id} self />
      )}

      {/* Trust Score explainer (§4.5) — display-only; Trust engine untouched */}
      <Modal isOpen={showTrustInfo} onClose={() => setShowTrustInfo(false)} title={TRUST_SCORE_INFO.title}>
        <ScoreExplainerBody info={TRUST_SCORE_INFO} />
      </Modal>

      {/* Form */}
      <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-5">
        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="font-display font-bold text-text-primary text-base flex items-center gap-2">
            <UserCircle size={15} className="text-accent" /> Basic Info
          </h2>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Full Name</label>
            <input {...register('name')} placeholder="Your name"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Bio</label>
            <textarea {...register('bio')} rows={3} placeholder="Tell others about yourself…"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary resize-none" />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Location</label>
            <input {...register('location')} placeholder="e.g. Dehradun, India"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
          </div>

          {/* Languages */}
          <div>
            <label htmlFor="profile-languages" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Spoken Languages <span className="normal-case text-text-muted lowercase">(search and pick up to {MAX_LANGUAGES})</span>
            </label>
            <LanguageMultiSelect
              id="profile-languages"
              value={langs}
              onChange={setLangs}
              maxSelections={MAX_LANGUAGES}
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="font-display font-bold text-text-primary text-base flex items-center gap-2">
            <LinkIcon size={15} className="text-accent" /> Social Links
          </h2>
          
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.4 13.4 0 0 0-7 0C6.2 3.4 5 3.8 5 3.8a5.5 5.5 0 0 0-.1 3.8A5.5 5.5 0 0 0 3.4 11.4c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/><path d="M9 20a5.5 5.5 0 0 1-5-2.5"/></svg>
              GitHub URL
            </label>
            <input {...register('socialLinks.github', {
              pattern: { value: /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+$/, message: 'Must be a valid GitHub URL' }
            })} placeholder="https://github.com/username"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              LinkedIn URL
            </label>
            <input {...register('socialLinks.linkedin', {
              pattern: { value: /^(https?:\/\/)?(www\.)?linkedin\.com\/.*$/, message: 'Must be a valid LinkedIn URL' }
            })} placeholder="https://linkedin.com/in/username"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2"><Globe size={14}/> Personal Website</label>
            <input {...register('socialLinks.website')} placeholder="https://yourwebsite.com"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={updateMutation.isPending}
          className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60">
          {updateMutation.isPending
            ? <><Spinner variant="arc" size={16} /> Saving…</>
            : <><Save size={15} /> Save Changes</>}
        </button>
      </form>

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAvatarModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-dark-lighter border border-border-subtle rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-display font-bold text-text-primary">Change Avatar</h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Upload Custom */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-text-secondary mb-3">Upload Custom Image</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border-subtle hover:border-accent hover:bg-accent/5 transition-all text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Spinner variant="arc" size={16} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Choose Image (Max 5MB)
                  </>
                )}
              </button>
            </div>

            {/* Preset Avatars */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-text-secondary mb-3">Or Select Preset</p>
              <div className="grid grid-cols-6 gap-3">
                {PRESET_AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => selectPresetAvatar(avatar)}
                    className="w-full aspect-square rounded-full overflow-hidden border-2 border-transparent hover:border-accent transition-all hover:scale-110"
                  >
                    <img src={avatar} alt="preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Remove Avatar */}
            {profile?.avatar && (
              <button
                onClick={removeAvatar}
                className="w-full py-2.5 text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Remove Avatar (Use Gradient)
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
      {/* ── Reviews Section ── */}
      <div className="mt-8 glass-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-display font-bold text-text-primary">Reviews</h2>
          <div className="flex gap-2 p-1 rounded-xl bg-surface border border-border-subtle self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setReviewTab('received')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                reviewTab === 'received' 
                  ? 'bg-accent/20 text-accent shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Received
            </button>
            <button
              type="button"
              onClick={() => setReviewTab('given')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                reviewTab === 'given' 
                  ? 'bg-accent/20 text-accent shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Given
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {reviewTab === 'received' && (
            receivedReviews?.length > 0 ? (
              receivedReviews.map(r => (
                <div key={r._id} className="p-4 rounded-xl bg-surface border border-border-subtle flex gap-4">
                  <Avatar name={r.fromUser?.name} url={r.fromUser?.avatar} size="md" userId={r.fromUser?._id} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <p className="font-semibold text-sm truncate">{r.fromUser?.name}</p>
                      <span className="text-xs text-text-muted flex-shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-[12px] ${i < r.score ? 'text-[#ffb800]' : 'text-text-muted'}`}>★</span>
                      ))}
                    </div>
                    <p className="text-sm text-text-secondary break-words">{r.review || "No written review provided."}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-text-muted py-8 bg-surface rounded-xl border border-border-subtle">No reviews received yet.</p>
            )
          )}

          {reviewTab === 'given' && (
            givenReviews?.length > 0 ? (
              givenReviews.map(r => (
                <div key={r._id} className="p-4 rounded-xl bg-surface border border-border-subtle flex gap-4">
                  <Avatar name={r.toUser?.name} url={r.toUser?.avatar} size="md" userId={r.toUser?._id} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <p className="font-semibold text-sm truncate">To: {r.toUser?.name}</p>
                      <span className="text-xs text-text-muted flex-shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-[12px] ${i < r.score ? 'text-[#ffb800]' : 'text-text-muted'}`}>★</span>
                      ))}
                    </div>
                    <p className="text-sm text-text-secondary break-words">{r.review || "No written review provided."}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-text-muted py-8 bg-surface rounded-xl border border-border-subtle">You haven't reviewed anyone yet.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
