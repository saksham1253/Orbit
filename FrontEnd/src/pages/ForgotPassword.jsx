import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Mail, ArrowLeft, CheckCircle, Sparkles, RotateCw } from 'lucide-react';
import api from '../services/api';
import Spinner from '../components/common/Spinner';

const RESEND_COOLDOWN = 30; // seconds

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const mutation = useMutation({
    mutationFn: (email) => api.post('/auth/forgot-password', { email }),
    onSuccess: () => { setSent(true); setCooldown(RESEND_COOLDOWN); },
  });

  // Tick the Resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  return (
    <>
      <Helmet>
        <title>Forgot Password | Orbit</title>
        <meta name="description" content="Reset your Orbit password." />
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
              Orbit
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
              <h2 className="text-xl font-display font-bold text-text-primary">Check your email</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                If an account exists for <span className="text-text-secondary font-medium break-words">{email}</span>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p className="text-xs text-text-muted">
                Don't see it? Check your <span className="text-text-secondary font-medium">spam</span> or
                <span className="text-text-secondary font-medium"> promotions</span> folder — it can take a minute to arrive.
              </p>

              {/* Resend with a short cooldown (re-posts the same email). */}
              <button
                type="button"
                onClick={() => { if (cooldown === 0 && !mutation.isPending) mutation.mutate(email); }}
                disabled={cooldown > 0 || mutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {mutation.isPending
                  ? <><Spinner variant="arc" size={16} /> Resending…</>
                  : <><RotateCw size={14} /> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}</>}
              </button>

              <div>
                <Link to="/login"
                  className="inline-flex items-center gap-2 mt-2 text-sm text-accent hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-xl font-display font-bold text-text-primary mb-1">Reset your password</h2>
                <p className="text-sm text-text-muted">Enter the email address registered to your account. We will send you a secure link to set a new password.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(email); }} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="Enter your email address"
                      autoComplete="email"
                      className="input-glass w-full pl-10 pr-4 py-3 text-sm text-text-primary"
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
                    <><Spinner variant="arc" size={16} /> Sending…</>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <p className="mt-6 text-center text-text-muted text-sm">
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
