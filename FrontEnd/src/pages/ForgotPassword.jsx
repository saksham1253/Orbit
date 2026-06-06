import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Mail, ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';
import api from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: (email) => api.post('/auth/forgot-password', { email }),
    onSuccess: () => setSent(true),
  });

  return (
    <>
      <Helmet>
        <title>Forgot Password | SkillSwap</title>
        <meta name="description" content="Reset your SkillSwap password." />
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
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold mb-1"
              style={{ background: 'linear-gradient(135deg, #00c6ff, #a855f7, #ff0076)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              SkillSwap
            </h1>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center">
                <CheckCircle size={56} className="text-green-400" style={{ color: '#00e5a0' }} />
              </div>
              <h2 className="text-xl font-display font-bold text-white">Check your email</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                If an account exists for <span className="text-white/80 font-medium">{email}</span>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 mt-4 text-sm text-accent hover:text-white transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-xl font-display font-bold text-white mb-1">Reset your password</h2>
                <p className="text-sm text-white/40">Enter the email associated with your account and we'll send a reset link.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(email); }} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="input-glass w-full pl-10 pr-4 py-3 text-sm text-white"
                    />
                  </div>
                </div>

                {mutation.isError && (
                  <p className="text-xs text-danger">{mutation.error?.response?.data?.message || 'Something went wrong. Please try again.'}</p>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending || !email}
                  className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <p className="mt-6 text-center text-white/35 text-sm">
                Remember your password?{' '}
                <Link to="/login" className="text-accent hover:text-accent-light transition-colors font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default ForgotPassword;
