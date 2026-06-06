import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-white/10 mt-auto relative z-10" style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="text-xl font-display font-bold"
              style={{ background: 'linear-gradient(135deg,#00c6ff,#0072ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              SkillSwap
            </Link>
            <p className="text-sm text-white/50 max-w-sm leading-relaxed">
              The premier peer-to-peer learning platform. Connect, share your expertise, and learn new skills from people all around the world.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.4 13.4 0 0 0-7 0C6.2 3.4 5 3.8 5 3.8a5.5 5.5 0 0 0-.1 3.8A5.5 5.5 0 0 0 3.4 11.4c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/><path d="M9 20a5.5 5.5 0 0 1-5-2.5"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-white/40 hover:text-[#1DA1F2] transition-colors">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="text-white/40 hover:text-[#0A66C2] transition-colors">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><Link to="/browse" className="hover:text-white transition-colors">Browse Skills</Link></li>
              <li><Link to="/nearby" className="hover:text-white transition-colors">Nearby Users</Link></li>
              <li><Link to="/trust" className="hover:text-white transition-colors">Trust Score</Link></li>
              <li><Link to="/profile" className="hover:text-white transition-colors">My Profile</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/guidelines" className="hover:text-white transition-colors">Community Guidelines</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} SkillSwap. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Built with <Heart size={12} className="text-[#ff0076]" /> for the community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
