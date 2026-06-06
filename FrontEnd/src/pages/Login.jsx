import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const Login = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const { addToast } = useUIStore();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const loginMutation = useMutation({
    mutationFn: (creds) => api.post('/auth/login', creds),
    onSuccess: async ({ data }) => {
      setToken(data.token);
      // Backend returns only token on login — fetch the user profile
      try {
        const profileRes = await api.get('/user/profile', {
          headers: { Authorization: `Bearer ${data.token}` }
        });
        setUser(profileRes.data);
      } catch {
        // Even if profile fetch fails, token is set — user will be loaded by app
      }
      navigate('/dashboard');
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Login failed', 'error');
    },
  });

  return (
    <>
    <Helmet>
      <title>Sign In | SkillSwap</title>
      <meta name="description" content="Sign in to your SkillSwap account to start exchanging skills with peers worldwide." />
      <meta property="og:title" content="Sign In | SkillSwap" />
      <meta property="og:description" content="Sign in to your SkillSwap account." />
      <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/login" />
      <meta name="twitter:title" content="Sign In | SkillSwap" />
      <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/login" />
    </Helmet>
    <div className="min-h-screen flex items-center justify-center p-4 relative">

      {/* Extra hero glow for auth page */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(0,114,255,0.1) 0%, transparent 70%)',
        }}
      />

      {/* Auth card */}
      <motion.div
        className="auth-card w-full max-w-md p-8 relative z-10"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Card inner glow top edge */}
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
          <h1
            className="text-3xl font-display font-bold mb-1"
            style={{
              background: 'linear-gradient(135deg, #00c6ff, #a855f7, #ff0076)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            SkillSwap
          </h1>
          <p className="text-white/40 text-sm">Exchange skills. Build expertise. Grow together.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl p-1 mb-7"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Link to="/login"
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-center transition-all"
            style={{ background: 'rgba(0,198,255,0.15)', color: '#00c6ff', border: '1px solid rgba(0,198,255,0.3)' }}
          >
            Sign In
          </Link>
          <Link to="/register"
            className="flex-1 py-2 rounded-lg text-sm font-medium text-center transition-all text-white/50 hover:text-white"
          >
            Create Account
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Email Address <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-required="true"
              {...register('email')}
              className="input-glass w-full px-4 py-3 text-sm text-white"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Password <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                aria-required="true"
                {...register('password')}
                className="input-glass w-full px-4 py-3 pr-11 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>
            )}
            <div className="flex justify-end mt-1.5">
              <Link to="/forgot-password" className="text-xs text-white/40 hover:text-accent transition-colors">
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {loginMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              <>
                Sign In
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* OAuth */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <span className="px-4 text-xs text-white/30 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
        </div>

        <div className="flex gap-3">
          <a
            href={`${API_BASE}/api/auth/google`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all text-white/70 hover:text-white"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </a>
          <a
            href={`${API_BASE}/api/auth/github`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all text-white/70 hover:text-white"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            GitHub
          </a>
        </div>

        <p className="mt-6 text-center text-white/35 text-sm">
          No account?{' '}
          <Link to="/register" className="text-accent hover:text-accent-light transition-colors font-medium">
            Create one free
          </Link>
        </p>

        {/* Trust badges - no emojis */}
        <div className="flex items-center justify-center gap-5 mt-6 pt-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-xs text-white/25">Secure Authentication</span>
          <span className="text-xs text-white/25">Trust Verified</span>
          <span className="text-xs text-white/25">Location Matched</span>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default Login;
