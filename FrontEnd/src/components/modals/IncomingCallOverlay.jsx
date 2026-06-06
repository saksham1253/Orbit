import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X } from 'lucide-react';

/**
 * IncomingCallOverlay
 * Full-screen overlay that appears when another user calls you.
 * The callee can Accept (navigates into the room), Decline (dismisses),
 * or Ignore (closes the overlay without answering).
 */
const IncomingCallOverlay = ({ call, onAccept, onDecline, onIgnore }) => {
  const audioRef = useRef(null);

  // Play a ringing tone while overlay is visible
  useEffect(() => {
    if (!call) return;
    // Simple oscillator-based ring using Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let stopped = false;

      const ring = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
        // Ring every 2 seconds
        setTimeout(ring, 2000);
      };
      ring();

      audioRef.current = { stop: () => { stopped = true; ctx.close(); } };
    } catch (_) {}

    return () => {
      audioRef.current?.stop();
    };
  }, [call]);

  return (
    <AnimatePresence>
      {call && (
        <motion.div
          key="incoming-call-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {/* Card */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,60,0.95) 0%, rgba(10,10,30,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 28,
              padding: '40px 36px 36px',
              maxWidth: 360,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,198,255,0.12)',
            }}
          >
            {/* Ignore / close button top-right */}
            <button
              onClick={onIgnore}
              title="Ignore call"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <X size={16} />
            </button>

            {/* Animated ringing avatar */}
            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 20px' }}>
              {/* Pulsing rings */}
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: -10 * (i + 1),
                    borderRadius: '50%',
                    border: '2px solid rgba(0,198,255,0.4)',
                  }}
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
                />
              ))}
              {/* Avatar circle */}
              <div style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00c6ff, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                fontWeight: 700,
                color: '#fff',
                border: '3px solid rgba(255,255,255,0.2)',
                position: 'relative',
                zIndex: 1,
              }}>
                {(call.callerName || 'U').charAt(0).toUpperCase()}
              </div>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
              Incoming Video Call
            </p>
            <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
              {call.callerName || 'Someone'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 36 }}>
              is calling you for a SkillSwap video session
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
              {/* Decline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={onDecline}
                  title="Decline call"
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 6px 24px rgba(239,68,68,0.45)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <PhoneOff size={28} color="#fff" />
                </button>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Decline</span>
              </div>

              {/* Accept */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <motion.button
                  onClick={onAccept}
                  title="Accept call"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    boxShadow: '0 6px 24px rgba(34,197,94,0.45)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Phone size={28} color="#fff" />
                </motion.button>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Accept</span>
              </div>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 28 }}>
              Call will auto-dismiss in 30 seconds
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallOverlay;
