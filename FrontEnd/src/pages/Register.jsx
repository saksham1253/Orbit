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
import Spinner from '../components/common/Spinner';
import { useUIStore } from '../store/uiStore';
import LanguageMultiSelect from '../components/common/LanguageMultiSelect';

const MAX_LANGUAGES = 5;

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

  const Register = () => {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState(['English']);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const password = watch('password', '');
  
  // Calculate password strength based on requirements
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  
  const requirementsMet = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;
  const strength = requirementsMet === 0 ? 0 : requirementsMet <= 2 ? 1 : requirementsMet <= 3 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Moderate', 'Strong'][strength];
  const strengthColor = ['', '#ff4b4b', '#ffb800', '#00e5a0'][strength];

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', { ...data, languages: selectedLangs }),
    onSuccess: () => {
      addToast('Account created! Please sign in.', 'success');
      navigate('/login');
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Registration failed', 'error');
    },
  });

  return (
    <>
    <Helmet>
      <title>Create Account | Orbit</title>
      <meta name="description" content="Join Orbit and start exchanging skills with peers around the world." />
      <meta property="og:title" content="Create Account | Orbit" />
      <meta property="og:description" content="Join Orbit — peer-to-peer skill exchange platform." />
      <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/register" />
      <meta name="twitter:title" content="Create Account | Orbit" />
      <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/register" />
    </Helmet>
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 relative z-10">

      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(124,58,237,0.09) 0%, transparent 70%)' }}
      />

      <motion.div
        className="auth-card w-full mx-auto p-5 sm:p-8 relative z-10 rounded-2xl border border-purple-500/20"
        style={{ maxWidth: 520, width: '100%', boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 25px 50px rgba(0,0,0,0.6)' }}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-px rounded-t-3xl"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)' }}
        />

        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ff0076 100%)', boxShadow: '0 0 30px rgba(124,58,237,0.35)' }}
            >
              <Sparkles size={24} className="text-text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-display font-bold text-text-primary mb-1">Create Your Account</h1>
          <p className="text-text-muted text-sm">Join thousands exchanging skills worldwide.</p>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 rounded-xl p-1 mb-7 w-full"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Link to="/login"
            className="flex-1 py-2 rounded-lg text-sm font-medium text-center transition-all text-text-secondary hover:text-text-primary"
          >
            Sign In
          </Link>
          <Link to="/register"
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-center transition-all"
            style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.35)' }}
          >
            Create Account
          </Link>
        </div>

        <form onSubmit={handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">

          {/* OAuth first — people prefer it */}
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <a href={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:8000'}/api/auth/google`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all text-text-secondary hover:text-text-primary"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>
            <a href={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:8000'}/api/auth/github`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all text-text-secondary hover:text-text-primary"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              Continue with GitHub
            </a>
          </div>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-xs text-white/25 uppercase tracking-widest">or register with email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>
          {/* Name */}
          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Full Name <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              aria-required="true"
              {...register('name')}
              className="input-glass w-full px-4 py-3 text-sm text-text-primary"
            />
            {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Email Address <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              aria-required="true"
              {...register('email')}
              className="input-glass w-full px-4 py-3 text-sm text-text-primary"
            />
            {errors.email && <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p>}
          </div>

          {/* Password + strength + requirements */}
          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Password <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                aria-required="true"
                {...register('password')}
                className="input-glass w-full px-4 py-3 pr-11 text-sm text-text-primary"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: strength >= i ? strengthColor : 'rgba(255,255,255,0.08)' }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</span>
                </div>
                
                {/* Password requirements checklist */}
                <div className="space-y-1">
                  <div className={`text-xs flex items-center gap-1.5 ${hasMinLength ? 'text-green-400' : 'text-text-muted'}`}>
                    <div className={`w-1 h-1 rounded-full ${hasMinLength ? 'bg-green-400' : 'bg-white/20'}`} />
                    At least 8 characters
                  </div>
                  <div className={`text-xs flex items-center gap-1.5 ${hasUpperCase ? 'text-green-400' : 'text-text-muted'}`}>
                    <div className={`w-1 h-1 rounded-full ${hasUpperCase ? 'bg-green-400' : 'bg-white/20'}`} />
                    One uppercase letter
                  </div>
                  <div className={`text-xs flex items-center gap-1.5 ${hasLowerCase ? 'text-green-400' : 'text-text-muted'}`}>
                    <div className={`w-1 h-1 rounded-full ${hasLowerCase ? 'bg-green-400' : 'bg-white/20'}`} />
                    One lowercase letter
                  </div>
                  <div className={`text-xs flex items-center gap-1.5 ${hasNumber ? 'text-green-400' : 'text-text-muted'}`}>
                    <div className={`w-1 h-1 rounded-full ${hasNumber ? 'bg-green-400' : 'bg-white/20'}`} />
                    One number
                  </div>
                  <div className={`text-xs flex items-center gap-1.5 ${hasSpecialChar ? 'text-green-400' : 'text-text-muted'}`}>
                    <div className={`w-1 h-1 rounded-full ${hasSpecialChar ? 'bg-green-400' : 'bg-white/20'}`} />
                    One special character (!@#$%^&*)
                  </div>
                </div>
              </div>
            )}
            {errors.password && <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Confirm Password <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-confirm-password"
                type={showConfirmPass ? 'text' : 'password'}
                autoComplete="new-password"
                aria-required="true"
                {...register('confirmPassword')}
                className="input-glass w-full px-4 py-3 pr-11 text-sm text-text-primary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1.5 text-xs text-danger">{errors.confirmPassword.message}</p>}
          </div>

          {/* Languages */}
          <div>
            <label htmlFor="register-languages" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Spoken Languages
              <span className="ml-1 normal-case text-white/25 lowercase">(search and pick up to {MAX_LANGUAGES})</span>
            </label>
            <LanguageMultiSelect
              id="register-languages"
              value={selectedLangs}
              onChange={setSelectedLangs}
              maxSelections={MAX_LANGUAGES}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed group"
            style={{ background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', color: 'white' }}          >
            {registerMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner variant="arc" size={16} />
                Creating Account…
              </span>
            ) : (
              <>
                Create Account
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-text-muted text-sm">
          Already a member?{' '}
          <Link to="/login" className="text-accent hover:text-accent-light transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
    </>
  );
};

export default Register;
