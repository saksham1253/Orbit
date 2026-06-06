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
  ShieldCheck, UserCircle, Menu, X, Handshake, Video, Settings as SettingsIcon, MessageCircle,
} from 'lucide-react';

const NAV = [
  { name: 'Skills',       path: '/dashboard',   Icon: Layers     },
  { name: 'Browse',       path: '/browse',       Icon: Compass    },
  { name: 'Matches',      path: '/matches',      Icon: Handshake  },
  { name: 'Connections',  path: '/connections',  Icon: Users      },
  { name: 'Nearby',       path: '/nearby',       Icon: Map        },
  { name: 'Video',        path: '/video',        Icon: Video      },
  { name: 'Trust',        path: '/trust',        Icon: ShieldCheck},
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
            className="flex items-center justify-between h-13 px-3 rounded-2xl transition-all duration-300"
            style={{
              height: 52,
              background: scrolled ? 'rgba(5,6,14,0.92)' : 'rgba(5,6,14,0.65)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: `1px solid ${scrolled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.07)'}`,
              boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.45)' : 'none',
            }}
          >
            {/* ── Brand ── */}
            <NavLink to="/" className="flex items-center gap-2 flex-shrink-0 mr-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#00c6ff,#7c3aed,#ff0076)', boxShadow: '0 0 14px rgba(0,198,255,0.35)' }}>
                S
              </div>
              <span className="text-base font-display font-bold hidden sm:block"
                style={{ background: 'linear-gradient(135deg,#00c6ff,#a855f7,#ff0076)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                SkillSwap
              </span>
            </NavLink>

            {/* ── Desktop nav pills ── */}
            <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center" aria-label="Main navigation">
              {navWithBadges.map(({ name, path, Icon, badge }) => {
                const active = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
                return (
                  <NavLink key={path} to={path}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 select-none"
                    style={{
                      background: active ? 'rgba(0,198,255,0.13)' : 'transparent',
                      border: active ? '1px solid rgba(0,198,255,0.35)' : '1px solid transparent',
                      color: active ? '#00c6ff' : 'rgba(255,255,255,0.55)',
                      letterSpacing: '0.02em',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'transparent'; } }}
                  >
                    <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                    {name}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full"
                        style={{ background: 'linear-gradient(135deg,#ff0076,#7c3aed)', color: '#fff', boxShadow: '0 2px 8px rgba(255,0,118,0.4)' }}
                        aria-label={`${badge} notification${badge !== 1 ? 's' : ''}`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {active && (
                      <motion.span layoutId="pill-dot"
                        className="absolute -top-px -right-px w-1.5 h-1.5 rounded-full"
                        style={{ background: '#00c6ff', boxShadow: '0 0 6px #00c6ff' }}
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* ── Right side ── */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <NavLink to="/profile" title="Profile"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-white/55 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Avatar name={user?.name} url={user?.avatar} size="xs" userId={user?._id} />
                <span className="hidden md:block max-w-[80px] truncate">{user?.name?.split(' ')[0]}</span>
              </NavLink>
              {/* Chat Button */}
              <button
                onClick={() => setChatOpen(true)}
                aria-label="Messages"
                title="Messages"
                className="relative hidden sm:flex items-center justify-center w-8 h-8 rounded-xl text-white/40 hover:text-accent transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
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
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl text-white/40 hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <SettingsIcon size={15} />
              </NavLink>
              <button
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="flex items-center justify-center w-8 h-8 rounded-xl text-white/40 hover:text-danger transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
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
                className="xl:hidden flex items-center justify-center w-8 h-8 rounded-xl text-white/60 hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
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
            className="fixed top-[72px] left-3 right-3 z-40 rounded-2xl overflow-hidden xl:hidden"
            style={{ background: 'rgba(5,6,16,0.96)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="p-3 grid grid-cols-2 gap-1.5">
              {navWithBadges.map(({ name, path, Icon, badge }) => (
                <NavLink key={path} to={path} onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-accent' : 'text-white/55 hover:text-white'}`
                  }
                  style={({ isActive }) => isActive ? { background: 'rgba(0,198,255,0.12)', border: '1px solid rgba(0,198,255,0.3)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
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
                className={({ isActive }) => `flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-accent' : 'text-white/55 hover:text-white'}`}
                style={({ isActive }) => isActive ? { background: 'rgba(0,198,255,0.12)', border: '1px solid rgba(0,198,255,0.3)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <UserCircle size={15} /> Profile
              </NavLink>
              <NavLink to="/settings" onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-accent' : 'text-white/55 hover:text-white'}`}
                style={({ isActive }) => isActive ? { background: 'rgba(0,198,255,0.12)', border: '1px solid rgba(0,198,255,0.3)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
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

      {/* Chat Drawer */}
      <ChatDrawer isOpen={chatOpen} onClose={() => { setChatOpen(false); setChatInitialUser(null); }} initialUser={chatInitialUser} />
    </>
  );
};

export default Navbar;
