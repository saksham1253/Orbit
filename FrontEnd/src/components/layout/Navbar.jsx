import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../common/Avatar';
import api from '../../services/api';
import ChatDrawer from '../chat/ChatDrawer';
import {
  LogOut, Layers, Compass, Users, Map,
  ShieldCheck, UserCircle, Menu, X, Handshake, Video, Settings as SettingsIcon, MessageCircle, Phone, Trophy
} from 'lucide-react';

const NAV = [
  { name: 'Skills',       path: '/dashboard',   Icon: Layers     },
  { name: 'Browse',       path: '/browse',       Icon: Compass    },
  { name: 'Matches',      path: '/matches',      Icon: Handshake  },
  { name: 'Connections',  path: '/connections',  Icon: Users      },
  { name: 'Nearby',       path: '/nearby',       Icon: Map        },
  { name: 'Calls',        path: '/video',        Icon: Phone      },
  { name: 'Trust',        path: '/trust',        Icon: ShieldCheck},
  { name: 'Leaderboard',  path: '/leaderboard',  Icon: Trophy     },
];

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialUser, setChatInitialUser] = useState(null);
  const drawerRef = useRef(null);
  const hamburgerRef = useRef(null);

  // Fetch counts for badges
  const { data: pending } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: () => api.get('/connections/pending').then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: matchesData } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.get('/skills/matches').then(res => res.data),
    refetchInterval: 60000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => api.get('/messages/unread-count').then(res => res.data),
    refetchInterval: 20000,
  });

  const incomingCount = pending?.incomingCount || 0;
  const matchesCount = Array.isArray(matchesData) ? matchesData.length : 0;
  const unreadCount = unreadData?.count || 0;

  const navWithBadges = NAV.map(item => {
    if (item.path === '/connections') return { ...item, badge: incomingCount };
    if (item.path === '/matches') return { ...item, badge: matchesCount };
    return item;
  });

  // Scroll detection
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        hamburgerRef.current?.focus(); // return focus to trigger
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  // Close on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const onPointerDown = (e) => {
      if (
        drawerRef.current && !drawerRef.current.contains(e.target) &&
        hamburgerRef.current && !hamburgerRef.current.contains(e.target)
      ) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [mobileOpen]);

  // Close drawer when route changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Listen for 'open-chat' custom event dispatched by ConnectionCard
  useEffect(() => {
    const handler = (e) => {
      setChatInitialUser(e.detail);
      setChatOpen(true);
    };
    window.addEventListener('open-chat', handler);
    return () => window.removeEventListener('open-chat', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <header className="sticky top-0 z-40 w-full" style={{ padding: scrolled ? '5px 0' : '10px 0' }}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5">
          <div
            className={`flex items-center justify-between px-3 rounded-2xl transition-all duration-300 ${scrolled ? 'nav-glass-scrolled' : 'nav-glass'}`}
            style={{ height: 52 }}
          >
            {/* ── Brand ── */}
            <NavLink to="/" className="flex items-center gap-2 flex-shrink-0 mr-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-3), var(--accent-2))', boxShadow: '0 0 14px var(--border-glow)' }}>
                S
              </div>
              <span className="text-base font-display font-bold hidden sm:block"
                style={{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-3), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                SkillSwap
              </span>
            </NavLink>

            {/* ── Desktop nav pills ── */}
            <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center" aria-label="Main navigation">
              {navWithBadges.map(({ name, path, Icon, badge }) => {
                const active = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
                return (
                  <NavLink key={path} to={path}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 select-none ${
                      active
                        ? 'text-accent bg-accent/10 border border-accent/30'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
                    }`}
                    style={{ letterSpacing: '0.02em' }}
                  >
                    <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                    {name}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full"
                        style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent-3))', color: '#fff', boxShadow: '0 2px 8px var(--border-glow)' }}
                        aria-label={`${badge} notification${badge !== 1 ? 's' : ''}`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {active && (
                      <motion.span layoutId="pill-dot"
                        className="absolute -top-px -right-px w-1.5 h-1.5 rounded-full"
                        style={{ background: 'var(--accent-1)', boxShadow: '0 0 6px var(--accent-1)' }}
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* ── Right side ── */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <NavLink to="/profile" title="Profile"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-text-secondary hover:text-text-primary bg-surface border border-border-subtle"
              >
                <Avatar name={user?.name} url={user?.avatar} size="xs" userId={user?._id} />
                <span className="hidden md:block max-w-[80px] truncate">{user?.name?.split(' ')[0]}</span>
              </NavLink>
              {/* Chat Button */}
              <button
                onClick={() => setChatOpen(true)}
                aria-label="Messages"
                title="Messages"
                className="relative hidden sm:flex items-center justify-center w-8 h-8 rounded-xl text-text-muted hover:text-accent transition-all bg-surface border border-border-subtle"
              >
                <MessageCircle size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full"
                    style={{ background: 'linear-gradient(135deg,#00c6ff,#0072ff)', color: '#fff', boxShadow: '0 2px 8px rgba(0,198,255,0.5)' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NavLink to="/settings"
                aria-label="Settings"
                title="Settings"
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl text-text-muted hover:text-text-primary transition-all bg-surface border border-border-subtle"
              >
                <SettingsIcon size={15} />
              </NavLink>
              <button
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="flex items-center justify-center w-8 h-8 rounded-xl text-text-muted hover:text-danger transition-all bg-surface border border-border-subtle"
              >
                <LogOut size={15} />
              </button>

              {/* Hamburger */}
              <button
                ref={hamburgerRef}
                onClick={() => setMobileOpen(v => !v)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-drawer"
                className="xl:hidden flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary transition-all bg-surface border border-border-subtle"
              >
                {mobileOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={drawerRef}
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-[72px] left-3 right-3 z-40 rounded-2xl overflow-hidden xl:hidden mobile-nav-glass"
          >
            <div className="p-3 grid grid-cols-2 gap-1.5">
              {navWithBadges.map(({ name, path, Icon, badge }) => (
                <NavLink key={path} to={path} onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-accent bg-accent/10 border border-accent/30' : 'text-text-secondary hover:text-text-primary bg-surface border border-border-subtle'}`
                  }
                >
                  <Icon size={15} /> {name}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full"
                      style={{ background: 'linear-gradient(135deg,#ff0076,#7c3aed)', color: '#fff' }}
                      aria-label={`${badge} notification${badge !== 1 ? 's' : ''}`}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </NavLink>
              ))}
              <NavLink to="/profile" onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-accent bg-accent/10 border border-accent/30' : 'text-text-secondary hover:text-text-primary bg-surface border border-border-subtle'}`}
              >
                <UserCircle size={15} /> Profile
              </NavLink>
              <NavLink to="/settings" onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-accent bg-accent/10 border border-accent/30' : 'text-text-secondary hover:text-text-primary bg-surface border border-border-subtle'}`}
              >
                <SettingsIcon size={15} /> Settings
              </NavLink>
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-danger/70 hover:text-danger transition-all"
                style={{ background: 'rgba(255,75,75,0.06)', border: '1px solid rgba(255,75,75,0.15)' }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Chat Button */}
      {user && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Messages"
          className="fixed sm:hidden bottom-6 right-6 z-[60] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95"
          style={{ background: 'var(--send-button-bg)', color: '#fff', boxShadow: 'var(--send-button-shadow)' }}
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center text-[12px] font-bold rounded-full bg-surface border border-border-subtle"
              style={{ color: 'var(--text-primary)' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Drawer */}
      <ChatDrawer isOpen={chatOpen} onClose={() => { setChatOpen(false); setChatInitialUser(null); }} initialUser={chatInitialUser} />
    </>
  );
};

export default Navbar;
