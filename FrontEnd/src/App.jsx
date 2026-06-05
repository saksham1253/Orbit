import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useNotificationStore } from './store/notificationStore';
import Layout from './components/layout/Layout';
import BackgroundEffects from './components/animations/BackgroundEffects';
import ToastContainer from './components/common/Toast';
import NotificationSystem from './components/notifications/NotificationSystem';
import RatingModal from './components/modals/RatingModal';
import io from 'socket.io-client';

// Eagerly loaded (first paint)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import OAuthCallback from './pages/OAuthCallback';

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

const PageLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-b-secondary animate-spin"
        style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
      />
    </div>
  </div>
);

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

function App() {
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

  return (
    <>
      {/* Global background — rendered once, stays behind everything */}
      <BackgroundEffects />
      <ToastContainer />
      
      {/* Notification System */}
      <NotificationSystem
        notifications={notifications}
        onDismiss={dismissNotification}
        onAction={handleNotificationAction}
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

      <Router>
        <Routes>
          {/* Public */}
          <Route path="/"               element={<Landing />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/register"       element={<Register />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />

          {/* Protected (lazy-loaded) */}
          <Route path="/dashboard"   element={<ProtectedRoute><MySkills /></ProtectedRoute>} />
          <Route path="/browse"      element={<ProtectedRoute><BrowseSkills /></ProtectedRoute>} />
          <Route path="/matches"     element={<ProtectedRoute><Matches /></ProtectedRoute>} />
          <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
          <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/nearby"      element={<ProtectedRoute><NearbyMap /></ProtectedRoute>} />
          <Route path="/trust"       element={<ProtectedRoute><TrustScore /></ProtectedRoute>} />
          <Route path="/settings"    element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/video"       element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
          <Route path="/call/:roomId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
