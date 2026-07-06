import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import api from './services/api';
import soundManager from './utils/soundManager';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
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
import { initNativeNotifications, postNativeNotification } from './utils/nativeNotify';
import { initPushNotifications } from './utils/pushNotify';
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
const Orbit          = lazy(() => import('./pages/Orbit'));
// Marketing "stardust reveal" brand animation — reachable by URL for preview /
// recording, not in nav. Mirrors marketing/orbit-teaser-reveal.html.
const OrbitTeaserReveal = lazy(() => import('./cosmic/OrbitTeaserReveal'));
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

/** True inside the Capacitor native shell (APK), false on the web. */
const isNativeApp = () => {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch { return false; }
};

/** Root "/" route. The website shows the marketing hero (Landing); the APK is a
 *  logged-in app shell, so it skips the hero and goes straight to the dashboard
 *  (or /login when signed out). APK-only behavior — the web is unchanged. */
const HomeRoute = () => {
  const token = useAuthStore((state) => state.token);
  if (isNativeApp()) return <Navigate to={token ? '/dashboard' : '/login'} replace />;
  return <Landing />;
};

/** Redirect authenticated users away from public-only pages (login, register).
 *  Honors a `from` location (A10) so a just-logged-in user returns to the page
 *  they originally requested instead of always landing on /dashboard. */
const PublicOnlyRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();
  if (token) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  return children;
};

/** Require authentication; redirect to login if not logged in, remembering the
 *  originally-requested location so we can return there after login (A10). */
const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </Layout>
  );
};

// Notification types that already render a dedicated rich popup (with action
// buttons) via their own per-type socket handler. The generic notification:new
// flash skips these so they never show twice. Any type NOT listed here falls
// through to the generic website flash — that's the universal coverage net.
const RICH_FLASH_TYPES = new Set([
  'perfect_match',
  'connection_request',
  'connection_accepted',
]);

// Inner component so useNavigate is inside Router context
function AppInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token, setUser } = useAuthStore();

  // Ensure the signed-in user is hydrated app-wide. On native (APK) OAuth the
  // token is stored even if the profile fetch blips, leaving `user` null — which
  // makes every client-side self-exclusion filter (Browse/Matches/Nearby) no-op
  // and was a likely cause of "I see myself in Browse" on the APK (B-01). A
  // reliable user._id fixes those defenses. Also self-heals a stale persisted
  // user that predates newer fields.
  useEffect(() => {
    if (token && !user?._id) {
      api.get('/user/profile').then(({ data }) => { if (data && data._id) setUser(data); }).catch(() => {});
    }
  }, [token, user?._id, setUser]);

  // Ambient music is a GLOBAL, persistent preference — not tied to any single
  // page. Previously it lived on the Landing page and its unmount stopped the
  // track, so navigating away (e.g. to Settings to switch theme) killed the music
  // and it never resumed — which read as "switching theme breaks the music".
  // Start it once here if enabled; the soundManager singleton then survives all
  // navigation + theme changes. Autoplay policy (mobile) is handled inside the
  // manager via a one-time gesture-unlock.
  useEffect(() => {
    if (soundManager.isMusicEnabled()) soundManager.startAmbientMusic();
  }, []);

  // Pause ambient music while a video call is active, resume when it ends — so
  // the (now global) track never plays over a call.
  const isVideoCallActive = useUIStore((s) => s.isVideoCallActive);
  useEffect(() => {
    soundManager.pauseAmbientForCall(isVideoCallActive);
  }, [isVideoCallActive]);
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

  // Durable-notification flash dedupe. Flashes can arrive two ways: the live
  // `notification:new` socket event (instant, but the socket is dead on the web
  // build behind the Cloudflare Worker) and an HTTP poll fallback below (works
  // everywhere). Both record ids here so a notification is flashed exactly once.
  const flashSeenRef = useRef(new Set());
  const flashSeededRef = useRef(false);
  // Reset when the signed-in user changes so a new account's backlog isn't
  // flashed and the previous user's ids don't leak across a logout/login.
  useEffect(() => {
    flashSeenRef.current = new Set();
    flashSeededRef.current = false;
  }, [user?._id]);

  // HTTP poll fallback for in-app flashes. The socket delivers `notification:new`
  // instantly on the APK, but never on the deployed website (its socket points at
  // the Worker, which can't carry the WebSocket upgrade) — so web users saw the
  // bell badge tick up with no flash. Polling the durable feed over plain HTTP
  // makes perfect-match / connection flashes appear on web too, within one tick.
  const { data: flashFeed } = useQuery({
    queryKey: ['notifications', 'flashfeed'],
    queryFn: () => api.get('/notifications', { params: { limit: 10 } }).then((r) => r.data),
    enabled: !!token,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const items = flashFeed?.items || [];
    if (!items.length) return;
    // First successful load: record the backlog without flashing it.
    if (!flashSeededRef.current) {
      items.forEach((n) => flashSeenRef.current.add(String(n._id)));
      flashSeededRef.current = true;
      return;
    }
    // Oldest → newest so a burst stacks in chronological order.
    [...items].reverse().forEach((n) => {
      const id = String(n._id);
      if (flashSeenRef.current.has(id)) return; // already flashed (socket or a prior poll)
      flashSeenRef.current.add(id);
      if (n.read) return; // read elsewhere already — no point flashing
      const link = n.data?.link;
      useNotificationStore.getState().addNotification({
        type: n.type || 'info',
        title: n.title || 'Notification',
        message: n.body || '',
        actions: link ? [{ label: 'View', primary: true, handler: () => navigate(link) }] : undefined,
        duration: 8000,
      });
    });
  }, [flashFeed, navigate]);

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

    // APK: keep the WebView content BELOW the Android status bar — without this
    // the navbar (top:0 sticky) sits under the battery/time icons, nav buttons
    // overlap. StatusBar.setOverlaysWebView(false) tells the WebView to inset
    // its top automatically. The safe-area-inset CSS isn't enough on Android
    // (viewport-fit=cover makes it draw edge-to-edge, and Android doesn't push
    // env(safe-area-inset-top) without this hint). No-op on web.
    import('@capacitor/status-bar').then(({ StatusBar }) => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    }).catch(() => {});

    // APK: ask for notification permission once and route taps to the right
    // screen. No-op on web (Capacitor.isNativePlatform() is false).
    initNativeNotifications((link) => navigate(link));

    return () => cleanup();
  }, [navigate]);

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

    // APK: register this device with FCM (needs the auth token, so it runs here
    // after login, not at mount). Delivers tray notifications even when the app
    // is fully killed. No-op on web. Taps route via the same navigate fn.
    initPushNotifications((link) => navigate(link));

    // ──────── Listen to notification events ────────

    // Durable notification center: refresh the bell's badge + list whenever the
    // server persists a new notification. Fires alongside the per-type events
    // below, so this is the single place the center stays in sync live.
    socket.on('notification:new', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'flashfeed'] });

      // Mark this id handled so the HTTP poll fallback never re-flashes it.
      if (payload?._id) flashSeenRef.current.add(String(payload._id));

      if (payload?.title || payload?.body) {
        // APK: surface it in the Android notification tray (no-op on web).
        postNativeNotification({
          title: payload.title,
          body: payload.body,
          link: payload?.data?.link || '/',
        });

        // Website flash: types with a dedicated rich popup (with action buttons)
        // are shown by their own per-type socket handlers below — skip those to
        // avoid a double toast. EVERY OTHER notification type (now or added later)
        // gets a generic in-app flash here, so the web never silently swallows a
        // server notification. This is the universal safety net.
        if (!RICH_FLASH_TYPES.has(payload.type)) {
          const link = payload?.data?.link;
          useNotificationStore.getState().addNotification({
            type: payload.type || 'info',
            title: payload.title || 'Notification',
            message: payload.body || '',
            actions: link ? [{ label: 'View', primary: true, handler: () => navigate(link) }] : undefined,
            duration: 8000,
          });
        }
      }
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
        <Route path="/"               element={<HomeRoute />} />
        <Route path="/login"          element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register"       element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        {/* Friendly aliases for guessed URLs (B-04) → canonical routes */}
        <Route path="/signup"         element={<Navigate to="/register" replace />} />
        <Route path="/signin"         element={<Navigate to="/login" replace />} />
        <Route path="/skills"         element={<Navigate to="/browse" replace />} />
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
        <Route path="/orbit"       element={<ProtectedRoute><Orbit /></ProtectedRoute>} />
        <Route path="/observatory" element={<ProtectedRoute><Observatory /></ProtectedRoute>} />
        <Route path="/cosmic-atlas" element={<Layout><Suspense fallback={<PageLoader />}><TierAtlas /></Suspense></Layout>} />
        <Route path="/settings"    element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/video"       element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
        <Route path="/call/:roomId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />

        {/* Cosmic badge gallery — dev/QA route, reachable by URL, not in nav */}
        <Route path="/cosmic-gallery" element={<Layout><Suspense fallback={<PageLoader />}><BadgeGallery /></Suspense></Layout>} />

        {/* Marketing brand-reveal preview — full-screen, no chrome, not in nav */}
        <Route path="/reveal" element={<Suspense fallback={null}><OrbitTeaserReveal standalone /></Suspense>} />

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
