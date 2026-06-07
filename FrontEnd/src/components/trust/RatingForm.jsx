import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Send } from 'lucide-react';
import api from '../../services/api';
import { useUIStore } from '../../store/uiStore';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

const RatingForm = ({ targetUserId, onClose }) => {
  const [rating,  setRating]  = useState(5);
  const [hovered, setHovered] = useState(0);
  const [review,  setReview]  = useState('');
  const { addToast }          = useUIStore();
  const queryClient           = useQueryClient();

  const active = hovered || rating;

  const mutation = useMutation({
    mutationFn: (d) => api.post('/trust/rate', d),
    onSuccess: () => {
      addToast('Review submitted!', 'success');
      queryClient.invalidateQueries({ queryKey: ['trustScore'] });
      onClose();
    },
    onError: (e) => addToast(e.response?.data?.message || 'Failed to submit', 'error'),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ toUserId: targetUserId, score: rating, review }); }}
      className="space-y-6">

      {/* Star selector */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} type="button"
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(s)}
              className="transition-transform hover:scale-115 focus:outline-none"
              style={{ transform: `scale(${active >= s ? 1.1 : 1})` }}
            >
              <Star size={36}
                fill={active >= s ? '#ffb800' : 'transparent'}
                style={{ color: active >= s ? '#ffb800' : 'rgba(255,255,255,0.2)', transition: 'all 0.15s' }}
              />
            </button>
          ))}
        </div>
        <span className="text-sm font-semibold"
          style={{ color: active >= 4 ? '#00e5a0' : active >= 3 ? '#ffb800' : '#ff4b4b' }}>
          {LABELS[active]}
        </span>
      </div>

      {/* Review textarea */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Review <span className="normal-case text-white/25 lowercase">(optional)</span>
        </label>
        <textarea rows={3} value={review} onChange={e => setReview(e.target.value)}
          placeholder="How was your skill-swap session?"
          className="input-glass w-full px-4 py-3 text-sm text-text-primary resize-none" />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
          {mutation.isPending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Send size={14} /> Submit Review</>}
        </button>
      </div>
    </form>
  );
};

export default RatingForm;
