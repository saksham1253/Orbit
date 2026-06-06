import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Send, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { useSound } from '../../utils/soundManager';
import Avatar from '../common/Avatar';

/**
 * Rating Modal - Appears after video call ends
 * User MUST rate before continuing (blocking modal)
 */

const RatingModal = ({ isOpen, onClose, otherUser, callDuration }) => {
  const { addToast } = useUIStore();
  const { playClick, playSuccess } = useSound();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');

  const submitRatingMutation = useMutation({
    mutationFn: (data) => api.post('/trust/rate', data),
    onSuccess: () => {
      playSuccess();
      addToast('Rating submitted successfully!', 'success');
      onClose();
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Failed to submit rating', 'error');
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      addToast('Please select a rating', 'error');
      return;
    }

    if (comment.trim().length < 10) {
      addToast('Please write at least 10 characters in your review', 'error');
      return;
    }

    submitRatingMutation.mutate({
      toUserId: otherUser._id,   // backend field name
      score: rating,             // backend field name
      review: comment.trim(),    // backend field name
      skillContext: 'video-call',
    });
  };

  const handleSkip = () => {
    addToast('Rating skipped.', 'info');
    onClose();
  };

  const handleRatingClick = (value) => {
    playClick();
    setRating(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-dark-lighter border border-white/10 rounded-3xl p-8 max-w-lg w-full"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Avatar
              name={otherUser.name}
              url={otherUser.avatar}
              size="xl"
              userId={otherUser._id}
            />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Rate Your Experience
          </h2>
          <p className="text-white/60 text-sm">
            How was your session with <span className="text-accent font-semibold">{otherUser.name}</span>?
          </p>
          {callDuration && (
            <p className="text-white/40 text-xs mt-1">
              Session duration: {Math.floor(callDuration / 60)}m {callDuration % 60}s
            </p>
          )}
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRatingClick(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-125"
            >
              <Star
                size={40}
                className={`${
                  star <= (hoveredRating || rating)
                    ? 'text-amber fill-amber'
                    : 'text-white/20'
                } transition-colors`}
              />
            </button>
          ))}
        </div>

        {/* Rating Labels */}
        {rating > 0 && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm font-semibold mb-4"
            style={{
              color:
                rating === 5
                  ? '#00e5a0'
                  : rating >= 4
                  ? '#ffb800'
                  : rating >= 3
                  ? '#ff9500'
                  : '#ff4b4b',
            }}
          >
            {rating === 5 && 'Excellent!'}
            {rating === 4 && 'Great!'}
            {rating === 3 && 'Good'}
            {rating === 2 && 'Okay'}
            {rating === 1 && 'Poor'}
          </motion.p>
        )}

        {/* Comment/Review */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-white/70 mb-2">
            Your Review <span className="text-danger">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience... What did you learn? Was the session helpful? (minimum 10 characters)"
            rows={4}
            className="input-glass w-full px-4 py-3 text-sm text-white resize-none"
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-white/40">
              {comment.length}/500 characters {comment.length < 10 && `(${10 - comment.length} more needed)`}
            </p>
            {comment.length >= 10 && (
              <p className="text-xs text-green-400">✓ Good to go!</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || comment.trim().length < 10 || submitRatingMutation.isPending}
          className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {submitRatingMutation.isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send size={16} />
              Submit Rating
            </>
          )}
        </button>

        {/* Skip option */}
        <button
          onClick={handleSkip}
          disabled={submitRatingMutation.isPending}
          className="w-full text-center text-xs text-white/35 hover:text-white/60 mt-3 py-1 transition-colors"
        >
          Skip for now
        </button>

        {/* Required Notice */}
        <p className="text-center text-xs text-white/25 mt-2">
          Rating helps improve the SkillSwap community
        </p>
      </motion.div>
    </div>
  );
};

export default RatingModal;
