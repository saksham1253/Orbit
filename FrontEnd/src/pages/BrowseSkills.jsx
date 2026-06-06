import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';
import SkillCard from '../components/skills/SkillCard';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { useUIStore } from '../store/uiStore';
import { Search, Compass, SlidersHorizontal, X } from 'lucide-react';
import UserRatingsModal from '../components/modals/UserRatingsModal';

const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'];

const BrowseSkills = () => {
  const [search, setSearch]           = useState('');
  const [level, setLevel]             = useState('all');
  const [viewRatingsUser, setViewRatingsUser] = useState(null); // { _id, name }
  const { addToast }                  = useUIStore();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', 'all'],
    queryFn: () => api.get('/skills/all').then(r => r.data),
  });

  const connectMutation = useMutation({
    mutationFn: ({ receiverId, skillId }) => api.post('/connections/request', { receiverId, skillId }),
    onSuccess: () => addToast('Connection request sent!', 'success'),
    onError: (e) => addToast(e.response?.data?.message || 'Failed to send request', 'error'),
  });

  const filtered = useMemo(() => {
    let list = skills;
    if (level !== 'all') list = list.filter(s => s.level === level);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.skillOffered?.toLowerCase().includes(q) ||
        s.skillWanted?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.userId?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [skills, search, level]);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#ff0076,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          <Compass size={26} style={{ color: '#ff0076', WebkitTextFillColor: '#ff0076' }} />
          Browse Skills
        </h1>
        <p className="text-white/40 mt-1 text-sm">Discover what the community is teaching and learning.</p>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search skills, people…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-glass w-full pl-10 pr-10 py-2.5 text-sm text-white"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-white/30 flex-shrink-0" />
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize"
              style={{
                background: level === l ? 'rgba(0,198,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${level === l ? 'rgba(0,198,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: level === l ? '#00c6ff' : 'rgba(255,255,255,0.5)',
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-xs text-white/30">{filtered.length} skill{filtered.length !== 1 ? 's' : ''} found</p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <LoadingSkeleton count={6} type="card" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="py-16 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <Search size={32} className="mx-auto text-white/15 mb-3" />
          <p className="text-white/40 text-sm">No skills match your search. Try different keywords.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(s => (
            <SkillCard
              key={s._id}
              skill={s}
              variant="browse"
              onConnect={(skillId, receiverId) => connectMutation.mutate({ skillId, receiverId })}
              onViewRatings={(owner) => setViewRatingsUser(owner)}
            />
          ))}
        </div>
      )}

      {/* View User Ratings Modal */}
      <UserRatingsModal
        user={viewRatingsUser}
        isOpen={!!viewRatingsUser}
        onClose={() => setViewRatingsUser(null)}
      />
    </div>
  );
};

export default BrowseSkills;
