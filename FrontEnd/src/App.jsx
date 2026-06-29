import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useNotificationStore } from './store/notificationStore';
import { useThemeStore } from './store/themeStore';
import useAppearanceStore from './store/appearanceStore';
import Layout from './components/layout/Layout';
import BackgroundEffects from './components/animations/BackgroundEffects';
import ToastContainer from './components/common/Toast';
import NotificationSystem from './components/notifications/NotificationSystem';
import RatingModal from './components/modals/RatingModal';
import IncomingCallOverlay from './components/modals/IncomingCallOverlay';
import NotFound from './pages/NotFound';
import Spinner from './components/common/Spinner';
import { connectSocket } from './services/socket';
import { initDeepLinkAuth } from './services/nativeAuth';
import { Toaster } from 'react-hot-toast';
import BadgeDefsSprite from './cosmic/BadgeDefsSprite';
import LiftoffWatcher from './cosmic/LiftoffWatcher';

// Eagerly loaded (first paint)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import OAuthCallback from './pages/OAuthCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Lazy loaded protected pages (code-split bundles)
const MySkills     = lazy(() => import('./pages/MySkills'));
const BrowseSkills = lazy(() => import('./pages/BrowseSkills'));
const Matches      = lazy(() => import('./pages/Matches'));
const Connections  = lazy(() => import('./pages/Connections'));
const Profile      = lazy(() => import('./pages/Profile'));
const NearbyMap    = lazy(() => import('./pages/NearbyMap'));
const TrustScore   = lazy(() => import('./pages/TrustScore'));
const VideoCall    = lazy(() => import('./pages/VideoCall'));
const Settings     = lazy(() => import('./pages/Settings'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const BadgeGallery   = lazy(() => import('./pages/BadgeGallery'));
const Leaderboard    = lazy(() => import('./pages/Leaderboard'));
const Observatory    = lazy(() => import('./pages/Observatory'));
const TierAtlas      = lazy(() => import('./pages/TierAtlas'));
// Heavy cinematics (canvas engine + share card) — split out of the initial
// bundle; only fetched when a rank-up actually fires.
const LiftoffOverlay = lazy(() => import('./cosmic/LiftoffOverlay'));

// Hidden Admin Command Center — resolved on the catch-all by AdminGate, which
// compares a SHA-256 hash of the visited path to VITE_ADMIN_SLUG_HASH. The slug
// itself never appears in the bundle; the admin code is lazy-split so it never
// loads for ordinary visitors. The server is the real gate (every admin API
// 404s without a valid admin session).
const AdminGate = lazy(() => import('./admin/AdminGate'));

const PageLoader = () => (
  <div className="flex items-center justify-center py-24">
    <Spinner variant="orbit" size={48} label="Loading page" />
  </div>
);

/** Redirect authenticated users away from public-only pages (login, register) */
const PublicOnlyRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
};

/** Require authentication; redirect to login if not logged in */
const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </Layout>
  );
};

// Inner component so useNavigate is inside Router context
function AppInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const {
    notifications,
    dismissNotification,
    handleNotificationAction,
    ratingModal,
    closeRatingModal,
    notifyConnectionRequest,
    notifyConnectionAccepted,
    notifyUserOffline,
    notifyCallEnded,
    notifyPerfectMatch,
  } = useNotificationStore();

  const { initializeTheme } = useThemeStore();
  const { initializeAppearance } = useAppearanceStore();
  // Animation Speed multiplier (off=0 / slow=0.5 / medium=1 / fast=1.5)
  const animationSpeed = useAppearanceStore((s) => s.animationSpeed);
  const getSpeedMultiplier = useAppearanceStore((s) => s.getSpeedMultiplier);

  // Apply persisted theme attributes to <html> on mount
  useEffect(() => {
    initializeTheme();
    initializeAppearance();
  }, [initializeTheme, initializeAppearance]);

  // Native (Capacitor) only: finish social login when the system browser
  // returns via the orbit:// deep link. No-op on the web build.
  useEffect(() => {
    let cleanup = () => {};
    initDeepLinkAuth().then((fn) => { cleanup = fn; });
    return () => cleanup();
  }, []);

  // Expose the Animation Speed as a global CSS var so purely-CSS animations
  // (cosmic badges, future liftoff effects) honor the setting — including
  // 0 = Off. Additive: nothing else reads --anim-speed / data-anim-off, so
  // this is inert for every existing component. When Off, we keep --anim-speed
  // at 1 (so calc() divisions stay valid) and disable via data-anim-off.
  useEffect(() => {
    const m = getSpeedMultiplier();
    const root = document.documentElement;
    root.style.setProperty('--anim-speed', String(m > 0 ? m : 1));
    root.setAttribute('data-anim-off', m === 0 ? 'true' : 'false');
  }, [animationSpeed, getSpeedMultiplier]);

  // Incoming call state — drives the full-screen overlay
  const [incomingCall, setIncomingCall] = useState(null); // { callerName, roomId }

  // Auto-dismiss after 30 s
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => setIncomingCall(null), 30000);
    return () => clearTimeout(timer);
  }, [incomingCall]);

  // Socket.IO connection and event listeners
  useEffect(() => {
    if (!token || !user) return;

    const socket = connectSocket(user._id);

    // ──────── Listen to notification events ────────

    // Durable notification center: refresh the bell's badge + list whenever the
    // server persists a new notification. Fires alongside the per-type events
    // below, so this is the single place the center stays in sync live.
    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    });

    // Perfect (reciprocal) match found — fired to BOTH people once per pair,
    // POV-framed by the server (v7 §3).
    socket.on('perfect-match', (data) => {
      notifyPerfectMatch(data.otherUser, data);
    });

    // New connection request received
    socket.on('connection-request', (data) => {
      notifyConnectionRequest(data.requester, data.skill);
    });

    // Connection accepted
    socket.on('connection-accepted', (data) => {
      notifyConnectionAccepted(data.receiverName);
    });

    // User offline
    socket.on('user-offline', (data) => {
      notifyUserOffline(data.userName);
    });

    // Incoming video call — show full-screen overlay instead of a notification.
    // Role-guard (v5 §3): never ring the caller's own device for their outgoing
    // call, and ignore a duplicate/late event for a call we're already showing.
    socket.on('incoming-call', (data) => {
      if (data?.callerId && user?._id && String(data.callerId) === String(user._id)) return;
      setIncomingCall((prev) =>
        prev && prev.roomId === data.roomId
          ? prev
          : { callerName: data.callerName, roomId: data.roomId }
      );
    });

    // Call ended - trigger rating modal
    socket.on('call-ended', (data) => {
      notifyCallEnded(data.otherUser, data.callDuration);
    });

    // Force disconnect (malicious content detected)
    socket.on('force-disconnect', (data) => {
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Call Terminated',
        message: data.reason || 'Call was terminated due to policy violation.',
        duration: 10000,
      });
    });

    // We don't disconnect the singleton completely here because other components (like ChatDrawer)
    // might still be relying on it while navigating. Disconnect is handled cleanly when logging out.
    return () => {
      socket.off('notification:new');
      socket.off('perfect-match');
      socket.off('connection-request');
      socket.off('connection-accepted');
      socket.off('user-offline');
      socket.off('incoming-call');
      socket.off('call-ended');
      socket.off('force-disconnect');
    };
  }, [token, user, queryClient, notifyConnectionRequest, notifyConnectionAccepted, notifyUserOffline, notifyCallEnded, notifyPerfectMatch]);

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;
    const { roomId } = incomingCall;
    setIncomingCall(null);
    navigate(`/call/${roomId}`, { state: { isCaller: false } });
  }, [incomingCall, navigate]);

  const handleDeclineCall = useCallback(() => {
    setIncomingCall(null);
    // Optionally notify caller — for now just dismiss
  }, []);

  const handleIgnoreCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return (
    <>
      {/* Global background — rendered once, stays behind everything */}
      <BackgroundEffects />
      {/* Shared SVG <defs> for cosmic badges — mounted once (ID-collision fix) */}
      <BadgeDefsSprite />
      {/* Rank-up "Liftoff" — overlay code-split, fetched only when it fires;
          watcher fires it on a genuine tier increase for the logged-in user */}
      <Suspense fallback={null}><LiftoffOverlay /></Suspense>
      {token && user && <LiftoffWatcher />}
      <ToastContainer />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-text)',
            border: '1px solid var(--toast-border)',
            boxShadow: 'var(--toast-shadow)',
          }
        }} 
      />

      {/* Notification System */}
      <NotificationSystem
        notifications={notifications}
        onDismiss={dismissNotification}
        onAction={handleNotificationAction}
      />

      {/* Full-Screen Incoming Call Overlay */}
      <IncomingCallOverlay
        call={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onIgnore={handleIgnoreCall}
      />

      {/* Rating Modal */}
      {ratingModal && (
        <RatingModal
          isOpen={ratingModal.isOpen}
          onClose={closeRatingModal}
          otherUser={ratingModal.otherUser}
          callDuration={ratingModal.callDuration}
        />
      )}

      <Routes>
        {/* Public — redirect logged-in users away */}
        <Route path="/"               element={<Landing />} />
        <Route path="/login"          element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register"       element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/forgot-password"         element={<ForgotPassword />} />
        <Route path="/reset-password/:token"   element={<ResetPassword />} />

        {/* Protected (lazy-loaded) */}
        <Route path="/dashboard"   element={<ProtectedRoute><MySkills /></ProtectedRoute>} />
        <Route path="/browse"      element={<ProtectedRoute><BrowseSkills /></ProtectedRoute>} />
        <Route path="/matches"     element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
        <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:userId" element={<Layout><Suspense fallback={<PageLoader />}><PublicProfile /></Suspense></Layout>} />
        <Route path="/nearby"      element={<ProtectedRoute><NearbyMap /></ProtectedRoute>} />
        <Route path="/trust"       element={<ProtectedRoute><TrustScore /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
        <Route path="/observatory" element={<ProtectedRoute><Observatory /></ProtectedRoute>} />
        <Route path="/cosmic-atlas" element={<Layout><Suspense fallback={<PageLoader />}><TierAtlas /></Suspense></Layout>} />
        <Route path="/settings"    element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/video"       element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
        <Route path="/call/:roomId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />

        {/* Cosmic badge gallery — dev/QA route, reachable by URL, not in nav */}
        <Route path="/cosmic-gallery" element={<Layout><Suspense fallback={<PageLoader />}><BadgeGallery /></Suspense></Layout>} />

        {/* 404 — catch-all. AdminGate renders the hidden portal only when the
            path hashes to VITE_ADMIN_SLUG_HASH; otherwise it returns this 404. */}
        <Route path="*" element={<Suspense fallback={null}><AdminGate fallback={<NotFound />} /></Suspense>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
