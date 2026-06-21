import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, CheckCircle, Sparkles, ArrowLeft, Check, X } from 'lucide-react';
import api from '../services/api';
import { useUIStore } from '../store/uiStore';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);

  // Same policy as registration (Register.jsx): 8+ chars, upper, lower, number, special.
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const requirements = [
    { ok: hasMinLength, label: 'At least 8 characters' },
    { ok: hasUpperCase, label: 'One uppercase letter' },
    { ok: hasLowerCase, label: 'One lowercase letter' },
    { ok: hasNumber, label: 'One number' },
    { ok: hasSpecialChar, label: 'One special character' },
  ];
  const passedCount = requirements.filter(r => r.ok).length;
  const isStrong = passedCount === requirements.length;

  const mutation = useMutation({
    mutationFn: (pwd) => api.post(`/auth/reset-password/${token}`, { password: pwd }),
    onSuccess: () => {
      setDone(true);
      addToast('Password reset! You can now sign in.', 'success');
      setTimeout(() => navigate('/login'), 2500);
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Reset failed. The link may have expired.', 'error');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isStrong) {
      addToast('Password must be 8+ chars with uppercase, lowercase, a number, and a special character', 'error');
      return;
    }
    if (password !== confirm) {
      addToast('Passwords do not match', 'error');
      return;
    }
    mutation.mutate(password);
  };

  return (
    <>
      <Helmet>
        <title>Reset Password | SkillSwap</title>
        <meta name="description" content="Set a new password for your SkillSwap account." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(0,114,255,0.1) 0%, transparent 70%)' }}
        />

        <motion.div
          className="auth-card w-full max-w-md p-8 relative z-10"
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute top-0 left-0 right-0 h-px rounded-t-3xl"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,198,255,0.4), transparent)' }}
          />

          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, #00c6ff 0%, #7c3aed 50%, #ff0076 100%)', boxShadow: '0 0 30px rgba(0,198,255,0.3)' }}
            >
              <Sparkles size={24} className="text-text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold mb-1"
              style={{ background: 'linear-gradient(135deg, #00c6ff, #a855f7, #ff0076)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              SkillSwap
            </h1>
          </div>

          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center">
                <CheckCircle size={56} style={{ color: '#00e5a0' }} />
              </div>
              <h2 className="text-xl font-display font-bold text-text-primary">Password Reset!</h2>
              <p className="text-sm text-text-secondary">Your password has been updated. Redirecting you to sign in…</p>
              <Link to="/login"
                className="inline-flex items-center gap-2 mt-2 text-sm text-accent hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={14} /> Go to Sign In
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-xl font-display font-bold text-text-primary mb-1">Set new password</h2>
                <p className="text-sm text-text-muted">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label htmlFor="new-password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="input-glass w-full px-4 py-3 pr-11 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Strength bar + requirements checklist (matches Register) */}
                  {password.length > 0 && (
                    <>
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all"
                            style={{
                              background: passedCount >= i
                                ? (passedCount >= 5 ? '#00e5a0' : passedCount >= 3 ? '#ffb800' : '#ff4b4b')
                                : 'rgba(255,255,255,0.1)'
                            }}
                          />
                        ))}
                      </div>
                      <ul className="mt-2.5 grid grid-cols-1 gap-1">
                        {requirements.map((r) => (
                          <li key={r.label} className="flex items-center gap-1.5 text-xs"
                            style={{ color: r.ok ? '#00e5a0' : 'var(--text-muted)' }}>
                            {r.ok ? <Check size={13} /> : <X size={13} />}
                            {r.label}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className="input-glass w-full px-4 py-3 text-sm text-text-primary"
                    style={confirm && confirm !== password ? { borderColor: 'rgba(255,75,75,0.5)' } : {}}
                  />
                  {confirm && confirm !== password && (
                    <p className="mt-1.5 text-xs text-danger">Passwords do not match</p>
                  )}
                </div>

                {mutation.isError && (
                  <p className="text-xs text-danger">{mutation.error?.response?.data?.message || 'Something went wrong.'}</p>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending || !isStrong || password !== confirm}
                  className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting…</>
                  ) : 'Reset Password'}
                </button>
              </form>

              <p className="mt-6 text-center text-text-muted text-sm">
                <Link to="/login" className="text-accent hover:text-text-primary transition-colors inline-flex items-center gap-1">
                  <ArrowLeft size={12} /> Back to Sign In
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default ResetPassword;
