import { Link } from 'react-router-dom';
import { Heart, Github, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-white/10 mt-auto relative z-10" style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="text-center md:text-left">
            <Link to="/" className="text-xl font-display font-bold inline-block mb-2"
              style={{ background: 'linear-gradient(135deg,#00c6ff,#0072ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              SkillSwap
            </Link>
            <p className="text-xs text-white/40">
              Peer-to-peer learning, completely free.
            </p>
          </div>
          
          {/* Essential Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/50">
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Get Started</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer noopener" className="hover:text-white transition-colors" aria-label="GitHub">
              <Github size={16} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer noopener" className="hover:text-white transition-colors" aria-label="Twitter">
              <Twitter size={16} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer noopener" className="hover:text-white transition-colors" aria-label="LinkedIn">
              <Linkedin size={16} />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-xs text-white/30 text-center md:text-right">
            <p className="flex items-center gap-1.5 justify-center md:justify-end mb-1">
              Built with <Heart size={11} className="text-[#ff0076]" fill="currentColor" /> for the community
            </p>
            <p>&copy; {new Date().getFullYear()} SkillSwap. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
export default Footer;
