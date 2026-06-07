import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
const Footer = () => {
  return (
    <footer className="border-t border-border-subtle mt-auto relative z-10 bg-surface backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="text-center md:text-left mb-6 md:mb-0">
            <h2 className="text-lg font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple mb-1">
              SkillSwap
            </h2>
            <p className="text-xs text-text-muted">
              Peer-to-peer learning community.
            </p>
          </div>
          
          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-text-secondary">
            <Link to="/browse" className="hover:text-accent transition-colors">Browse Skills</Link>
            <Link to="/register" className="hover:text-text-primary transition-colors">Get Started</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer noopener" className="hover:text-text-primary transition-colors" aria-label="GitHub">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4" />
              </svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer noopener" className="hover:text-text-primary transition-colors" aria-label="Twitter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer noopener" className="hover:text-text-primary transition-colors" aria-label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>

          {/* Social / Copy */}
          <div className="text-xs text-text-muted text-center md:text-right">
            <p className="flex items-center gap-1.5 justify-center md:justify-end mb-1">
              Built with <Heart size={11} className="text-accent" fill="currentColor" /> for the community
            </p>
            <p>&copy; {new Date().getFullYear()} SkillSwap. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
