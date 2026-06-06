import { useRef, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, BookOpen, Users, Award, Map,
  Star, ShieldCheck, Zap, ChevronDown, TrendingUp, Lightbulb,
} from 'lucide-react';
import TypeWriter from '../components/animations/TypeWriter';
import api from '../services/api';
import { useSound } from '../utils/soundManager';
import { useAuthStore } from '../store/authStore';
import Footer from '../components/layout/Footer';

/* ── Motivational quotes that rotate (clean, no emojis) ── */
const MOTIVATIONAL_QUOTES = [
  { text: "Every expert was once a beginner.", author: "Robin Sharma" },
  { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese Proverb" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "Share your knowledge. It is a way to achieve immortality.", author: "Dalai Lama" },
  { text: "Teaching is the highest form of understanding.", author: "Aristotle" },
];

/* ── Floating animated skill pills (clean, no emojis) ── */
const PILLS = [
  { label: 'Guitar',       top: '12%', left: '5%',  delay: 0,   dur: 5   },
  { label: 'Python',       top: '22%', right: '7%', delay: 0.8, dur: 6   },
  { label: 'UI Design',    top: '60%', left: '4%',  delay: 1.4, dur: 4.5 },
  { label: 'Spanish',      top: '72%', right: '5%', delay: 0.4, dur: 7   },
  { label: 'Photography',  top: '38%', left: '3%',  delay: 2,   dur: 5.5 },
  { label: 'Cooking',      top: '45%', right: '4%', delay: 1,   dur: 6.5 },
  { label: 'Illustration', top: '82%', left: '7%',  delay: 1.7, dur: 4.8 },
  { label: 'React',        top: '15%', right: '18%',delay: 0.2, dur: 5.2 },
];

const FloatingPill = ({ label, top, left, right, delay, dur }) => (
  <motion.div
    className="hero-pill absolute hidden lg:block"
    style={{
      top, left, right,
      '--duration': `${dur}s`,
      '--delay': `${delay}s`,
      zIndex: 1,
    }}
    initial={{ opacity: 0, scale: 0.7, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay: delay + 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
  >
    {label}
  </motion.div>
);

/* ── Animated stat counter ── */
const StatDisplay = ({ value, suffix = '', prefix = '' }) => {
  return (
    <span className="tabular-nums">
      {prefix}{value?.toLocaleString() || '0'}{suffix}
    </span>
  );
};

/* ── Feature card ── */
const FeatureCard = ({ icon, title, description, color, delay }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="skill-card p-7 group cursor-default"
    >
      <div
        className="w-13 h-13 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color}22, ${color}08)`,
          border: `1px solid ${color}30`,
          width: 52, height: 52,
        }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{description}</p>
    </motion.div>
  );
};

/* ── Main Landing ── */
const Landing = () => {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const heroRef = useRef(null);
  const { startMusic, stopMusic, isMusicEnabled } = useSound();
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Rotate motivational quotes every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real platform stats
  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/users/stats').then(res => res.data),
    staleTime: 60000, // Cache for 1 minute
  });

  // Start ambient music on hero page if enabled
  useEffect(() => {
    if (isMusicEnabled()) {
      startMusic();
    }
    
    return () => {
      stopMusic();
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      <Helmet>
        <title>SkillSwap — Exchange Skills, Grow Together</title>
        <meta name="description" content="Peer-to-peer skill exchange platform. Teach what you know, learn what you don't. Completely free." />
        <meta property="og:title" content="SkillSwap — Exchange Skills, Grow Together" />
        <meta property="og:description" content="Join the world's most vibrant peer-to-peer skill exchange network. Share your expertise, unlock new skills, and build genuine connections — completely free." />
        <meta property="og:image" content="https://react-skill-swap-fully-fledged.vercel.app/og-image.png" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SkillSwap — Exchange Skills, Grow Together" />
        <meta name="twitter:description" content="Peer-to-peer skill exchange platform. Teach what you know, learn what you don't." />
        <meta name="twitter:image" content="https://react-skill-swap-fully-fledged.vercel.app/og-image.png" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/" />
      </Helmet>

      {/* ══════════════ HERO SECTION ══════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center px-4">

        {/* Extra hero gradient burst */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,198,255,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 40% 40% at 80% 60%, rgba(255,0,118,0.09) 0%, transparent 70%),
              radial-gradient(ellipse 40% 40% at 20% 70%, rgba(124,58,237,0.09) 0%, transparent 70%)
            `,
          }}
        />

        {/* Floating skill pills */}
        {PILLS.map((p) => <FloatingPill key={p.label} {...p} />)}

        {/* ── Ripples: Apple-level composition ─────────────────────────────
            Two ripple origins create diagonal tension across the canvas.
            Primary: just beyond the right edge — sweeping arcs flow inward.
            Secondary: top-left corner, partially off-screen — a ghost arc.
            Like two stones dropped in still water at opposite corners.
        ─────────────────────────────────────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">

          {/* PRIMARY — right edge origin, larger rings, prominent */}
          {[1, 2, 3, 4, 5, 6].map((i) => {
            const size = 140 + i * 105;
            return (
              <div
                key={`r-${i}`}
                className="ripple-ring"
                style={{
                  width: size,
                  height: size,
                  position: 'absolute',
                  top: '58%',
                  right: '-2%',
                  marginTop: -(size / 2),
                  marginRight: -(size / 2),
                  animationDelay: `${(i - 1) * 0.75}s`,
                  opacity: 0.13 - i * 0.01,
                  borderColor: 'rgba(0, 198, 255, 0.55)',
                }}
              />
            );
          })}

          {/* SECONDARY — top-left ghost, much smaller + subtler */}
          {[1, 2, 3].map((i) => {
            const size = 180 + i * 120;
            return (
              <div
                key={`l-${i}`}
                className="ripple-ring"
                style={{
                  width: size,
                  height: size,
                  position: 'absolute',
                  top: '-5%',
                  left: '-4%',
                  marginTop: -(size / 2),
                  marginLeft: -(size / 2),
                  animationDelay: `${i * 1.1}s`,
                  opacity: 0.06,
                  borderColor: 'rgba(124, 58, 237, 0.5)',
                  borderWidth: '1px',
                }}
              />
            );
          })}
        </div>

        {/* Hero content - removed scroll transforms for performance */}
        <div className="relative text-center max-w-4xl mx-auto pt-24 pb-16 z-10">
          {/* Status pill with rotating motivational quote */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-medium"
              style={{
                background: 'rgba(0,198,255,0.08)',
                border: '1px solid rgba(0,198,255,0.25)',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              Peer-to-Peer Learning — Now Live
              <ArrowRight size={13} className="text-accent" />
            </div>
            
            {/* Motivational quote rotator (clean, no sparkle emoji) */}
            <div className="h-16 flex items-center justify-center px-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={quoteIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <p className="text-sm text-white/60 italic mb-1">
                    "{MOTIVATIONAL_QUOTES[quoteIndex].text}"
                  </p>
                  <p className="text-xs text-white/40">— {MOTIVATIONAL_QUOTES[quoteIndex].author}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Headline - Keep bulb, remove rocket */}
          <motion.h1
            className="text-5xl sm:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.05]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="relative inline-block">
              <TypeWriter 
                text="Learn anything." 
                speed={90}
                delay={500}
              />
              <motion.div
                className="absolute -right-8 -top-2 hidden sm:block"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 1.8, duration: 0.5, type: "spring" }}
              >
                <Lightbulb size={28} className="text-amber" fill="currentColor" />
              </motion.div>
            </span>
            {' '}
            <br className="hidden sm:block" />
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00c6ff 0%, #a855f7 35%, #ff0076 65%, #ffb800 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 4s linear infinite',
              }}
            >
              <TypeWriter 
                text="Teach everything." 
                speed={90}
                delay={1700}
              />
            </span>
          </motion.h1>

          {/* Subtitle with enhanced motivation */}
          <motion.p
            className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Join the world's most vibrant peer-to-peer skill exchange network.
            <span className="block mt-2 text-white/70 font-medium">
              Share your expertise, unlock new skills, and build genuine connections — 
              <span 
                className="text-transparent bg-clip-text font-bold ml-1"
                style={{
                  background: 'linear-gradient(90deg, #00e5a0, #00c6ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                completely free.
              </span>
            </span>
          </motion.p>

          {/* CTA buttons with enhanced motivation */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
          >
            {token ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-gradient w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-base group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Go to Dashboard
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                />
              </button>
            ) : (
              <Link
                to="/register"
                className="btn-gradient w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-base group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Your Learning Journey
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                />
              </Link>
            )}
            {!token && (
              <Link
                to="/login"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white/80 font-medium text-base transition-all hover:text-white hover:border-accent/40"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                Sign In
              </Link>
            )}
          </motion.div>

          {/* Creative animated skill categories instead of loading stats */}
          <motion.div
            className="flex flex-wrap justify-center gap-6 sm:gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            {[
              { category: 'Tech & Code', count: '2.5K+', icon: BookOpen, color: '#00c6ff' },
              { category: 'Creative Arts', count: '1.8K+', icon: Star, color: '#ff0076' },
              { category: 'Languages', count: '100+', icon: Users, color: '#a855f7' },
              { category: 'Life Skills', count: '1.4K+', icon: TrendingUp, color: '#00e5a0' },
            ].map(({ category, count, icon: Icon, color }, index) => (
              <motion.div 
                key={category}
                className="text-center group cursor-default"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  delay: 0.8 + index * 0.1,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200
                }}
                whileHover={{ scale: 1.08, y: -4 }}
              >
                <motion.div
                  className="mb-2 flex justify-center"
                  animate={{ 
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                    delay: index * 0.3
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${color}15`,
                      border: `1.5px solid ${color}40`,
                    }}
                  >
                    <Icon size={20} style={{ color }} strokeWidth={2.5} />
                  </div>
                </motion.div>
                <div 
                  className="text-xl font-bold transition-colors mb-0.5"
                  style={{ color }}
                >
                  {count}
                </div>
                <div className="text-xs text-white/50 font-medium">{category}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={18} />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════ FEATURES ══════════════ */}
      <section className="py-28 px-4 relative">
        {/* Section gradient accent */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(124,58,237,0.06) 0%, transparent 70%)' }}
        />

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              className="text-3xl sm:text-5xl font-display font-bold text-white mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
            >
              Built for{' '}
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 800,
                  background: 'linear-gradient(90deg, #00c6ff, #ff0076)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                real learners
              </span>
            </motion.h2>
            <motion.p
              className="text-white/45 max-w-xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              Everything you need to exchange skills meaningfully, safely, and at no cost.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard delay={0}    color="#00c6ff" icon={<BookOpen size={24} color="#00c6ff" />}  title="Smart Skill Matching"   description="Our algorithm instantly pairs you with partners who teach what you want and want what you teach." />
            <FeatureCard delay={0.08} color="#00e5a0" icon={<Map size={24} color="#00e5a0" />}       title="Hyper-Local Discovery"  description="Interactive map shows nearby members for in-person meetups, workshops, and coffee-shop sessions." />
            <FeatureCard delay={0.16} color="#ffb800" icon={<ShieldCheck size={24} color="#ffb800" />} title="AI Trust Scoring"     description="Automated Trust Score analyzes session feedback and flags bad actors to keep your community safe." />
            <FeatureCard delay={0.24} color="#a855f7" icon={<Zap size={24} color="#a855f7" />}      title="Instant Video Calls"    description="Jump into secure, high-quality WebRTC sessions from any connection card — no downloads needed." />
            <FeatureCard delay={0.32} color="#ff0076" icon={<Award size={24} color="#ff0076" />}    title="Reputation System"      description="Earn badges, build your profile score, and showcase verifiable expertise to the community." />
            <FeatureCard delay={0.4}  color="#00c6ff" icon={<Users size={24} color="#00c6ff" />}    title="Global Community"       description="Break borders. Learn languages, programming, music, and art from diverse cultures worldwide." />
          </div>
        </div>
      </section>

      {/* ══════════════ SOCIAL PROOF / CTA ══════════════ */}
      <section className="py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,198,255,0.08) 0%, rgba(124,58,237,0.1) 50%, rgba(255,0,118,0.07) 100%)',
              border: '1px solid rgba(0,198,255,0.2)',
            }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
          >
            {/* Decorative blobs inside card */}
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(0,198,255,0.12), transparent 70%)', filter: 'blur(40px)' }}
            />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,0,118,0.1), transparent 70%)', filter: 'blur(40px)' }}
            />

            <div className="relative z-10">
              <div className="flex justify-center mb-5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={22} className="text-amber" fill="currentColor" />
                ))}
              </div>

              <h3 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
                Ready to grow?
              </h3>
              <p className="text-white/50 mb-10 max-w-lg mx-auto">
                Join thousands of learners exchanging skills every day. Your next breakthrough is one connection away.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {token ? (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-gradient flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white text-base group w-full sm:w-auto justify-center relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Go to Dashboard
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: '200%' }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                    />
                  </button>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn-gradient flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white text-base group w-full sm:w-auto justify-center relative overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        Start Learning Today — Free Forever
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                      />
                    </Link>
                    <Link
                      to="/login"
                      className="flex items-center gap-2 px-8 py-4 rounded-2xl font-medium text-white/70 hover:text-white text-base transition-all w-full sm:w-auto justify-center hover:border-accent/40"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </div>

              {/* Trust badges with enhanced visuals */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-white/40">
                <motion.span 
                  className="flex items-center gap-1.5 hover:text-accent transition-colors cursor-default"
                  whileHover={{ scale: 1.05 }}
                >
                  <ShieldCheck size={14} className="text-accent" /> 100% Secure
                </motion.span>
                <motion.span 
                  className="flex items-center gap-1.5 hover:text-amber transition-colors cursor-default"
                  whileHover={{ scale: 1.05 }}
                >
                  <Award size={14} className="text-amber" /> Trust Verified
                </motion.span>
                <motion.span 
                  className="flex items-center gap-1.5 hover:text-green-400 transition-colors cursor-default"
                  whileHover={{ scale: 1.05 }}
                >
                  <Map size={14} className="text-green-400" /> Global Network
                </motion.span>
                <motion.span 
                  className="flex items-center gap-1.5 hover:text-purple-400 transition-colors cursor-default"
                  whileHover={{ scale: 1.05 }}
                >
                  <Zap size={14} className="text-purple-400" /> AI-Powered
                </motion.span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <Footer />
    </div>
  );
};

export default Landing;
