import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send, UserCircle } from 'lucide-react';
import api from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import Avatar from '../common/Avatar';

const SwapRequestModal = ({ isOpen, onClose, skill, owner }) => {
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setMessage('');
    }
  }, [isOpen]);

  const connectMutation = useMutation({
    mutationFn: (data) => api.post('/connections/request', data),
    onSuccess: () => {
      addToast('Swap request sent!', 'success');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      onClose();
    },
    onError: (e) => {
      addToast(e.response?.data?.message || 'Failed to send request', 'error');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    connectMutation.mutate({
      receiverId: owner._id,
      skillId: skill._id,
      message,
    });
  };

  if (!isOpen || !skill || !owner) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-dark-lighter border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 relative bg-surface">
            <h3 className="text-lg font-display font-bold text-text-primary flex items-center gap-2">
              <Send size={18} className="text-accent" /> Request Swap
            </h3>
            <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            
            {/* Target Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-surface">
              <Avatar url={owner.avatar} name={owner.name} size="lg" userId={owner._id} />
              <div>
                <p className="font-semibold text-text-primary">Swap with {owner.name}</p>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <span className="text-text-muted">You want:</span>
                  <span className="pill-offer text-xs">{skill.skillOffered}</span>
                </div>
              </div>
            </div>

            <form id="swap-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">Message (Optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Say hi! Let them know why you'd be a great match..."
                  className="input-glass w-full px-4 py-3 text-sm text-text-primary resize-none"
                  rows={4}
                  maxLength={500}
                />
                <div className="text-right mt-1 text-xs text-text-muted">
                  {message.length}/500
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/5 bg-surface flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="swap-form"
              disabled={connectMutation.isPending}
              className="btn-gradient px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {connectMutation.isPending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
              ) : (
                <><Send size={15} /> Send Request</>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SwapRequestModal;
