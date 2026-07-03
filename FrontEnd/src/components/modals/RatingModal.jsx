import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Send, Share2, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { useSound } from '../../utils/soundManager';
import Avatar from '../common/Avatar';
import { buildSessionCard, shareOrDownload } from '../../cosmic/sessionCard';

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
  const [learned, setLearned] = useState('');
  const [step, setStep] = useState('rate');   // 'rate' → 'card'
  const [cardUrl, setCardUrl] = useState('');

  const submitRatingMutation = useMutation({
    mutationFn: (data) => api.post('/trust/rate', data),
    onSuccess: () => {
      playSuccess();
      addToast('Rating submitted — nice session! ✨', 'success');
      // Post-session ritual: generate a shareable session card and show it
      // instead of closing immediately (viral loop).
      try {
        setCardUrl(buildSessionCard({
          partnerName: otherUser.name,
          rating,
          learned: learned.trim(),
          durationSec: callDuration || 0,
        }));
        setStep('card');
      } catch {
        onClose(); // card is a bonus; never block the close on a canvas hiccup
      }
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

  const handleShareCard = async () => {
    try {
      const result = await shareOrDownload(cardUrl, {
        filename: 'orbit-session.png',
        text: `Just finished a skill swap on Orbit${learned.trim() ? ` — ${learned.trim()}` : ''}!`,
      });
      addToast(result === 'downloaded' ? 'Session card saved 📸' : 'Shared! ✨', 'success');
    } catch {
      addToast('Could not share the card', 'error');
    }
  };

  if (!isOpen) return null;

  // Step 2 — the shareable session card (post-session ritual / viral loop).
  if (step === 'card') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-dark-lighter border border-border-subtle rounded-3xl p-6 max-w-lg w-full"
        >
          <h2 className="text-xl font-display font-bold text-text-primary text-center mb-4">
            Your session card 🌌
          </h2>
          {cardUrl && (
            <img src={cardUrl} alt="Shareable session card" className="w-full rounded-2xl border border-border-subtle mb-5" />
          )}
          <button
            onClick={handleShareCard}
            className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm"
          >
            <Share2 size={16} /> Share / Save
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-1.5 text-center text-sm text-text-muted hover:text-text-secondary mt-3 py-1 transition-colors"
          >
            <Check size={14} /> Done
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-dark-lighter border border-border-subtle rounded-3xl p-8 max-w-lg w-full"
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
          <h2 className="text-2xl font-display font-bold text-text-primary mb-2">
            Rate Your Experience
          </h2>
          <p className="text-text-secondary text-sm">
            How was your session with <span className="text-accent font-semibold">{otherUser.name}</span>?
          </p>
          {callDuration && (
            <p className="text-text-muted text-xs mt-1">
              Session duration: {Math.floor(callDuration / 60)}m {callDuration % 60}s
            </p>
          )}
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              aria-label={`Rate ${star} stars`}
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
                    : 'text-text-muted'
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
          <label className="block text-sm font-semibold text-text-secondary mb-2">
            Your Review <span className="text-danger">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience... What did you learn? Was the session helpful? (minimum 10 characters)"
            rows={4}
            className="input-glass w-full px-4 py-3 text-sm text-text-primary resize-none"
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-text-muted">
              {comment.length}/500 characters {comment.length < 10 && `(${10 - comment.length} more needed)`}
            </p>
            {comment.length >= 10 && (
              <p className="text-xs text-green">✓ Good to go!</p>
            )}
          </div>
        </div>

        {/* One thing you learned — feeds the shareable session card (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-text-secondary mb-2">
            One thing you learned <span className="text-text-muted font-normal">(for your session card)</span>
          </label>
          <input
            type="text"
            value={learned}
            onChange={(e) => setLearned(e.target.value)}
            placeholder="e.g. barre chords finally clicked!"
            maxLength={90}
            className="input-glass w-full px-4 py-3 text-sm text-text-primary"
          />
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
          className="w-full text-center text-xs text-text-muted hover:text-text-secondary mt-3 py-1 transition-colors"
        >
          Skip for now
        </button>

        {/* Required Notice */}
        <p className="text-center text-xs text-text-muted mt-2">
          Rating helps improve the Orbit community
        </p>
      </motion.div>
    </div>
  );
};

export default RatingModal;
