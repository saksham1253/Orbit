import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';
import SkillCard from '../components/skills/SkillCard';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { useUIStore } from '../store/uiStore';
import { Handshake, Sparkles } from 'lucide-react';

const Matches = () => {
  const { addToast } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ['skills', 'matches'],
    queryFn: () => api.get('/skills/matches').then(r => r.data),
  });

  const connectMutation = useMutation({
    mutationFn: ({ receiverId, skillId }) => api.post('/connections/request', { receiverId, skillId }),
    onSuccess: () => addToast('Connection request sent!', 'success'),
    onError: (e) => addToast(e.response?.data?.message || 'Failed to send request', 'error'),
  });

  const matches = data?.matches || [];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#00e5a0,#00c6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          <Handshake size={26} style={{ color: '#00e5a0', WebkitTextFillColor: '#00e5a0' }} />
          Your Matches
        </h1>
        <p className="text-white/40 mt-1 text-sm">People whose skills perfectly align with yours — mutual exchanges.</p>
      </div>

      {/* Count badge */}
      {!isLoading && matches.length > 0 && (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
          style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', color: '#00e5a0' }}>
          <Sparkles size={13} /> {matches.length} perfect match{matches.length !== 1 ? 'es' : ''} found
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <LoadingSkeleton count={3} type="card" />
        </div>
      ) : matches.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="py-20 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(0,229,160,0.15)' }}>
          <Handshake size={36} className="mx-auto mb-4" style={{ color: 'rgba(0,229,160,0.25)' }} />
          <h3 className="text-lg font-bold text-white mb-2">No matches yet</h3>
          <p className="text-white/40 text-sm max-w-xs mx-auto">
            Add more skills or browse the community. Matches appear when someone offers what you want and wants what you offer.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {matches.map(s => (
            <SkillCard key={s._id} skill={s} variant="match"
              onConnect={(skillId, receiverId) => connectMutation.mutate({ skillId, receiverId })} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Matches;
