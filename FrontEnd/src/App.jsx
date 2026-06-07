import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
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
import io from 'socket.io-client';
import { Toaster } from 'react-hot-toast';

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

const PageLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-border-subtle border-t-accent animate-spin" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-b-secondary animate-spin"
        style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
      />
    </div>
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
    notifySkillMatch,
  } = useNotificationStore();

  const { initializeTheme } = useThemeStore();
  const { initializeAppearance } = useAppearanceStore();

  // Apply persisted theme attributes to <html> on mount
  useEffect(() => {
    initializeTheme();
    initializeAppearance();
  }, [initializeTheme, initializeAppearance]);

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

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
    const socket = io(socketUrl);

    // Register user for notifications
    socket.emit('register', user._id);

    // ──────── Listen to notification events ────────

    // Skill match found
    socket.on('skill-match', (data) => {
      notifySkillMatch(data.matchedUser, data.skill);
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

    // Incoming video call — show full-screen overlay instead of a notification
    socket.on('incoming-call', (data) => {
      setIncomingCall({ callerName: data.callerName, roomId: data.roomId });
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

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [token, user, notifyConnectionRequest, notifyConnectionAccepted, notifyUserOffline, notifyCallEnded, notifySkillMatch]);

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
      <ToastContainer />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: '#1a1f2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
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
        <Route path="/settings"    element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/video"       element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
        <Route path="/call/:roomId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />

        {/* 404 — catch-all */}
        <Route path="*" element={<NotFound />} />
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
