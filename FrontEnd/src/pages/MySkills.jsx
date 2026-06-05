import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';
import SkillCard from '../components/skills/SkillCard';
import SkillForm from '../components/skills/SkillForm';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { Plus, Layers, Sparkles } from 'lucide-react';

const MySkills = () => {
  const [formOpen, setFormOpen] = useState(false);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', 'my'],
    queryFn: () => api.get('/skills/my').then(r => r.data),
  });

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg,#00c6ff,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            <Layers size={26} style={{ color: '#00c6ff', WebkitTextFillColor: '#00c6ff' }} />
            My Skills
          </h1>
          <p className="text-white/40 mt-1 text-sm">What you teach and what you want to learn.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          <Plus size={16} /> Add Skill
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <LoadingSkeleton count={3} type="card" />
        </div>
      ) : skills.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(0,198,255,0.2)' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,198,255,0.1)', border: '1px solid rgba(0,198,255,0.2)' }}>
            <Sparkles size={24} className="text-accent" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No skills yet</h3>
          <p className="text-white/40 text-sm mb-6 max-w-xs">Add what you can teach and what you want to learn to start matching.</p>
          <button onClick={() => setFormOpen(true)}
            className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm">
            <Plus size={15} /> Add Your First Skill
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map(s => <SkillCard key={s._id} skill={s} variant="my-skills" />)}
        </div>
      )}

      <SkillForm isOpen={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
};

export default MySkills;
