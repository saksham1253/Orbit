import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Home, Compass } from 'lucide-react';

const NotFound = () => (
  <>
    <Helmet>
      <title>404 — Page Not Found | SkillSwap</title>
      <meta name="robots" content="noindex" />
    </Helmet>

    <div className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 40%, rgba(124,58,237,0.08) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-lg relative z-10"
      >
        {/* Giant 404 */}
        <div
          className="text-[120px] sm:text-[160px] font-display font-black leading-none mb-4 select-none"
          style={{
            background: 'linear-gradient(135deg, #00c6ff 0%, #7c3aed 50%, #ff0076 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: 0.18,
          }}
        >
          404
        </div>

        {/* Icon */}
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 -mt-8"
          style={{
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: '0 0 30px rgba(124,58,237,0.15)',
          }}
        >
          <Compass size={28} style={{ color: '#a78bfa' }} />
        </div>

        <h1 className="text-3xl font-display font-bold text-white mb-3">
          Page Not Found
        </h1>
        <p className="text-white/45 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or may have been moved.
          Let's get you back on track.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm btn-gradient"
          >
            <Home size={15} />
            Go Home
          </Link>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white/65 hover:text-white transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Compass size={15} />
            Browse Skills
          </Link>
        </div>
      </motion.div>
    </div>
  </>
);

export default NotFound;
