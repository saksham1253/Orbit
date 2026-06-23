import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Repeat2 } from 'lucide-react';
import api from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';

const schema = z.object({
  skillOffered:  z.string().min(2, 'Required'),
  skillWanted:   z.string().min(2, 'Required'),
  description:   z.string().optional(),
  level:         z.enum(['beginner', 'intermediate', 'advanced']),
});

const LEVEL_OPTS = [
  { value: 'beginner',     label: 'Beginner',     color: '#00e5a0' },
  { value: 'intermediate', label: 'Intermediate', color: '#ffb800' },
  { value: 'advanced',     label: 'Advanced',     color: '#00c6ff' },
];

const SkillForm = ({ isOpen, onClose }) => {
  const { addToast }   = useUIStore();
  const queryClient    = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { level: 'intermediate' },
  });

  const selectedLevel = watch('level');

  const mutation = useMutation({
    mutationFn: (d) => api.post('/skills/add', d),
    onSuccess: () => {
      addToast('Skill added!', 'success');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['cosmic'] }); // refresh standing (v7 §1)
      reset();
      onClose();
    },
    onError: (e) => addToast(e.response?.data?.message || 'Failed to add skill', 'error'),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a New Skill">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">

        {/* Offer / Want row */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">I can teach</label>
            <input {...register('skillOffered')} placeholder="e.g. JavaScript, Guitar"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
            {errors.skillOffered && <p className="mt-1 text-xs text-danger">{errors.skillOffered.message}</p>}
          </div>
          <div className="flex-shrink-0 mt-7 text-text-muted"><Repeat2 size={18} /></div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">I want to learn</label>
            <input {...register('skillWanted')} placeholder="e.g. Python, Piano"
              className="input-glass w-full px-4 py-3 text-sm text-text-primary" />
            {errors.skillWanted && <p className="mt-1 text-xs text-danger">{errors.skillWanted.message}</p>}
          </div>
        </div>

        {/* Level selector */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">My level in the skill I'm offering</label>
          <div className="flex gap-2">
            {LEVEL_OPTS.map(({ value, label, color }) => (
              <button key={value} type="button" onClick={() => setValue('level', value)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: selectedLevel === value ? `${color}18` : 'var(--bg-surface-hover)',
                  border: `1px solid ${selectedLevel === value ? `${color}50` : 'var(--border-subtle)'}`,
                  color: selectedLevel === value ? color : 'var(--text-muted)',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Description <span className="normal-case text-text-muted lowercase">(optional)</span></label>
          <textarea {...register('description')} rows={2}
            placeholder="Any specific details about your offer…"
            className="input-glass w-full px-4 py-3 text-sm text-text-primary resize-none" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-all"
            style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)' }}>
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending}
            className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
            {mutation.isPending
              ? <Spinner variant="arc" size={16} />
              : <><ArrowRight size={14} /> Add Skill</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SkillForm;
