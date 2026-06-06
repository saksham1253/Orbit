import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Check, UserCircle, Shield, Save, Camera, Upload, X, Github, Linkedin, Link as LinkIcon } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import Avatar from '../components/common/Avatar';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const LANGUAGES = ['English','Spanish','French','Hindi','German','Mandarin','Japanese','Arabic','Portuguese','Korean'];

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
  const fileInputRef = useRef(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/user/profile').then(r => r.data),
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
      setLangs(profile.languages?.length ? profile.languages : ['English']);
    }
  }, [profile, setValue]);

  const toggleLang = (lang) => {
    setLangs(prev =>
      prev.includes(lang)
        ? prev.length > 1 ? prev.filter(l => l !== lang) : prev
        : prev.length < 5 ? [...prev, lang] : prev
    );
  };

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/user/profile', { ...data, languages: langs }),
    onSuccess: ({ data }) => {
      addToast('Profile saved!', 'success');
      setUser({ ...user, name: data.user?.name || user?.name });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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

  if (isLoading) return <LoadingSkeleton count={1} type="card" />;

  const trust = profile?.trustScore ?? 0;
  const trustColor = trust >= 70 ? '#00e5a0' : trust >= 40 ? '#ffb800' : '#ff4b4b';

  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <Helmet>
        <title>Your Profile | SkillSwap</title>
        <meta name="description" content="Manage your SkillSwap profile, avatar, and personal details." />
        <meta property="og:title" content="Your Profile | SkillSwap" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/profile" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/profile" />
      </Helmet>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold"
          style={{ background: 'linear-gradient(135deg,#ffb800,#ff0076)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Profile Settings
        </h1>
        <p className="text-white/40 mt-1 text-sm">Your public persona on SkillSwap.</p>
      </div>

      {/* Avatar + meta card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-5 p-6 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="relative">
          <Avatar name={profile?.name || user?.name} size="xl" userId={profile?._id || user?._id} url={profile?.avatar} />
          <button
            onClick={() => setShowAvatarModal(true)}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:scale-110 transition-transform"
            style={{ boxShadow: '0 4px 12px rgba(0,198,255,0.4)' }}
          >
            <Camera size={14} className="text-white" />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-white truncate">{profile?.name || user?.name}</p>
          <p className="text-sm text-white/40 truncate">{profile?.email || user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Shield size={13} style={{ color: trustColor }} />
            <span className="text-xs font-semibold" style={{ color: trustColor }}>
              Trust Score: {trust}/100
            </span>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-5">
        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-display font-bold text-white text-base flex items-center gap-2">
            <UserCircle size={15} className="text-accent" /> Basic Info
          </h2>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Full Name</label>
            <input {...register('name')} placeholder="Your name"
              className="input-glass w-full px-4 py-3 text-sm text-white" />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Bio</label>
            <textarea {...register('bio')} rows={3} placeholder="Tell others about yourself…"
              className="input-glass w-full px-4 py-3 text-sm text-white resize-none" />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Location</label>
            <input {...register('location')} placeholder="e.g. Dehradun, India"
              className="input-glass w-full px-4 py-3 text-sm text-white" />
          </div>

          {/* Languages */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
              Spoken Languages <span className="normal-case text-white/25 lowercase">(up to 5)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => {
                const active = langs.includes(lang);
                return (
                  <button key={lang} type="button" onClick={() => toggleLang(lang)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: active ? 'rgba(0,198,255,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? 'rgba(0,198,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: active ? '#00c6ff' : 'rgba(255,255,255,0.5)',
                    }}>
                    {active && <Check size={10} strokeWidth={3} />}
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-display font-bold text-white text-base flex items-center gap-2">
            <LinkIcon size={15} className="text-accent" /> Social Links
          </h2>
          
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><Github size={14}/> GitHub URL</label>
            <input {...register('socialLinks.github', {
              pattern: { value: /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+$/, message: 'Must be a valid GitHub URL' }
            })} placeholder="https://github.com/username"
              className="input-glass w-full px-4 py-3 text-sm text-white" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><Linkedin size={14}/> LinkedIn URL</label>
            <input {...register('socialLinks.linkedin', {
              pattern: { value: /^(https?:\/\/)?(www\.)?linkedin\.com\/.*$/, message: 'Must be a valid LinkedIn URL' }
            })} placeholder="https://linkedin.com/in/username"
              className="input-glass w-full px-4 py-3 text-sm text-white" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><Globe size={14}/> Personal Website</label>
            <input {...register('socialLinks.website')} placeholder="https://yourwebsite.com"
              className="input-glass w-full px-4 py-3 text-sm text-white" />
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={updateMutation.isPending}
          className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60">
          {updateMutation.isPending
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
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
            className="bg-dark-lighter border border-white/10 rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-display font-bold text-white">Change Avatar</h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Upload Custom */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-white/60 mb-3">Upload Custom Image</p>
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 hover:border-accent hover:bg-accent/5 transition-all text-white/70 hover:text-white disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              <p className="text-sm font-semibold text-white/60 mb-3">Or Select Preset</p>
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
    </div>
  );
};

export default Profile;
