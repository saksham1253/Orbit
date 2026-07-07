import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PhoneOff, Video, Clock, Phone, PhoneIncoming, PhoneMissed, Mic, MicOff, VideoIcon, VideoOff, Trash2, PenTool, MonitorUp } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useNotificationStore } from '../store/notificationStore';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../components/common/Avatar';
import { VideoCallHistorySkeleton } from '../components/skeletons';
import ConfirmDialog from '../components/common/ConfirmDialog';
import io from 'socket.io-client';
import DraggableVideoTile from '../whiteboard/DraggableVideoTile';
import useCallLayoutStore from '../store/callLayoutStore';

// Whiteboard is a large module — load it only when a call actually opens it.
const Whiteboard = lazy(() => import('../whiteboard/Whiteboard'));

// Small matchMedia hook — true on phone-portrait widths (drives the compact
// control bar). SSR-safe and updates on rotate/resize.
const useIsMobile = () => {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const on = (e) => setM(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return m;
};

// Capacitor Android/iOS WebView detection (screen-share APIs differ there).
const isNativeApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const canScreenShare = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && !isNativeApp();

/* ── Direct WebRTC Video Call Component ── */
const DirectVideoCall = ({ roomId, onEnd, otherUser, isCaller, autoBoard }) => {
  const { user, token } = useAuthStore();
  const { addToast, setVideoCallActive } = useUIStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remotePipRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const endedRef = useRef(false);      // guard: teardown runs exactly once
  const iceTimerRef = useRef(null);    // grace timer for transient ICE "disconnected"

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const isMobile = useIsMobile();
  // Reset-layout affordance for the draggable PiP tiles (Phase C).
  const resetLayout = useCallLayoutStore((s) => s.resetLayout);
  const layoutCustomized = useCallLayoutStore((s) => !!(s.self || s.remote));

  useEffect(() => {
    setVideoCallActive(true);
    return () => setVideoCallActive(false);
  }, [setVideoCallActive]);

  // Reopened from call history → jump straight into the saved board.
  useEffect(() => { if (autoBoard) setShowWhiteboard(true); }, [autoBoard]);

  useEffect(() => {
    let mounted = true;

    const initializeCall = async () => {
      try {
        let stream;
        try {
          // 1. Try get full user media (camera + microphone)
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
          });
        } catch (mediaErr) {
          console.warn('Full media failed, trying fallback:', mediaErr.message);
          try {
            // Fallback 1: Try audio only
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            setIsVideoEnabled(false);
            addToast('Camera unavailable. Using audio only.', 'warning');
          } catch (audioErr) {
            console.warn('Audio fallback failed:', audioErr.message);
            // Fallback 2: Receive only (no local stream)
            stream = new MediaStream(); // empty stream
            setIsVideoEnabled(false);
            setIsAudioEnabled(false);
            addToast('No media devices found. You are in receive-only mode.', 'error');
          }
        }

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && stream.getTracks().length > 0) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Connect to signaling server. Send the JWT so the server can derive
        // socket.userId (used to gate whiteboard writes to real participants).
        const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com' : 'http://localhost:8000');
        socketRef.current = io(socketUrl, token ? { auth: { token } } : undefined);

        // 3. Setup WebRTC
        // TURN relay is required for symmetric-NAT / cellular peers. Credentials
        // come from env (VITE_TURN_URL/USERNAME/CREDENTIAL) in production; the
        // openrelay fallback keeps existing behavior until real TURN is set.
        const iceServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
        if (import.meta.env.VITE_TURN_URL) {
          iceServers.push({
            urls: import.meta.env.VITE_TURN_URL.split(','),
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          });
        } else {
          iceServers.push(
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
          );
        }
        const pc = new RTCPeerConnection({ iceServers });

        peerConnectionRef.current = pc;

        // Add local stream tracks to peer connection
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Handle incoming remote stream
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setIsConnected(true);
            setIsConnecting(false);
            // Start call timer when connected
            callStartTimeRef.current = Date.now();
          }
        };

        // Auto-end on a lost/closed peer connection (closed tab, dropped network).
        // "failed"/"closed" end immediately; "disconnected" can be transient on
        // mobile, so we give it a short grace window to recover before tearing down.
        pc.oniceconnectionstatechange = () => {
          const st = pc.iceConnectionState;
          if (st === 'failed' || st === 'closed') {
            handleCallEnd();
          } else if (st === 'disconnected') {
            if (iceTimerRef.current) clearTimeout(iceTimerRef.current);
            iceTimerRef.current = setTimeout(() => {
              const s = peerConnectionRef.current?.iceConnectionState;
              if (s === 'disconnected' || s === 'failed' || s === 'closed') {
                addToast('Call ended', 'info');
                handleCallEnd();
              }
            }, 4000);
          } else if (st === 'connected' || st === 'completed') {
            if (iceTimerRef.current) { clearTimeout(iceTimerRef.current); iceTimerRef.current = null; }
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit('ice-candidate', {
              roomId,
              candidate: event.candidate
            });
          }
        };

        // Join room
        socketRef.current.emit('join-video-room', { roomId, userId: user?._id });

        if (isCaller && otherUser) {
          socketRef.current.emit('call-user', {
            roomId,
            targetUserId: otherUser._id,
            callerName: user?.name,
            callerId: user?._id, // lets the callee role-guard the incoming-call (v5 §3)
          });
        }

        // Handle signaling
        socketRef.current.on('user-joined', async () => {
          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit('video-offer', { roomId, offer });
        });

        socketRef.current.on('video-offer', async ({ offer }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit('video-answer', { roomId, answer });
        });

        socketRef.current.on('video-answer', async ({ answer }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socketRef.current.on('ice-candidate', async ({ candidate }) => {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        });

        socketRef.current.on('user-left', () => {
          setIsConnected(false);
          addToast('Call ended', 'info');
          handleCallEnd();
        });

        setIsConnecting(false);

      } catch (err) {
        console.error('Error initializing call:', err);
        addToast(err.message || 'Failed to access camera/microphone', 'error');
        onEnd();
      }
    };

    initializeCall();

    return () => {
      mounted = false;

      // Cleanup
      if (iceTimerRef.current) { clearTimeout(iceTimerRef.current); iceTimerRef.current = null; }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      if (socketRef.current) {
        socketRef.current.emit('leave-video-room', { roomId });
        socketRef.current.disconnect();
      }
    };
  }, [roomId, user, addToast]);

  const handleCallEnd = () => {
    // Run exactly once — this can be triggered by the End button, an ICE-state
    // drop, or the peer's user-left at the same time.
    if (endedRef.current) return;
    endedRef.current = true;

    // Tell the other peer to tear down FIRST, while the socket is still alive
    // (the room-scoped relay flows through the adapter). Doing this here — not
    // only in unmount cleanup — avoids the emit racing socket.disconnect(), which
    // is why the call previously did not auto-end on the other side.
    if (socketRef.current) {
      socketRef.current.emit('leave-video-room', { roomId });
    }

    // Calculate call duration
    let callDuration = 0;
    if (callStartTimeRef.current) {
      callDuration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    }

    // Emit call-ended event to trigger rating modal (unchanged payload/flow)
    if (socketRef.current && otherUser && callDuration > 0) {
      socketRef.current.emit('call-ended', {
        roomId,
        userId: user?._id,
        otherUserId: otherUser._id,
        callDuration
      });
    }

    onEnd(callDuration, otherUser);
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Screen share: swap the outgoing video track via replaceTrack (no
  // renegotiation needed). Requires a camera video sender to swap back to.
  const stopShare = async () => {
    const pc = peerConnectionRef.current;
    const sender = pc?.getSenders().find((s) => s.track && s.track.kind === 'video');
    const cam = localStreamRef.current?.getVideoTracks()[0];
    if (sender && cam) { try { await sender.replaceTrack(cam); } catch { /* */ } }
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsSharing(false);
  };

  const toggleScreenShare = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    if (!canScreenShare()) { addToast('Screen sharing isn\'t supported on this device.', 'warning'); return; }
    if (isSharing) { stopShare(); return; }
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!sender) { addToast('Turn on your camera before sharing your screen.', 'warning'); return; }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen;
      const track = screen.getVideoTracks()[0];
      await sender.replaceTrack(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = screen;
      track.onended = () => stopShare();   // user hit the browser "Stop sharing" chip
      setIsSharing(true);
    } catch { /* user cancelled the picker */ }
  };

  // Keep a small remote-video PiP in sync while the whiteboard covers the stage.
  useEffect(() => {
    if (showWhiteboard && remotePipRef.current && remoteVideoRef.current) {
      remotePipRef.current.srcObject = remoteVideoRef.current.srcObject;
    }
  }, [showWhiteboard, isConnected]);

  // Control-bar sizing — compact on phone-portrait so 5 controls + the safe-area
  // inset fit one row without clipping; roomier on desktop.
  const btn = isMobile
    ? { size: 46, big: 54, icon: 19, gap: 12, padY: 12 }
    : { size: 56, big: 64, icon: 22, gap: 20, padY: 18 };
  const ctrlBtn = { width: btn.size, height: btn.size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'background 0.2s' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 }}>
      {/* Remote video area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#111' }}
        />
        
        {/* Connecting overlay */}
        {isConnecting && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="animate-spin motion-reduce:animate-none" style={{ width: 60, height: 60, border: '4px solid rgba(255,255,255,0.15)', borderTopColor: '#00c6ff', borderRadius: '50%', margin: '0 auto 16px' }} />
              <p style={{ color: '#fff', fontSize: 18, marginBottom: 8, fontWeight: 600 }}>Connecting...</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Waiting for the other person to join</p>
            </div>
          </div>
        )}

        {/* Whiteboard overlay (board-focus). Video shrinks to PiPs. */}
        {showWhiteboard && (
          <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00c6ff', zIndex: 20 }}>Loading board…</div>}>
            <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
              <Whiteboard
                socket={socketRef.current}
                pc={peerConnectionRef.current}
                roomId={roomId}
                user={user}
                otherUser={otherUser}
                onClose={() => setShowWhiteboard(false)}
              />
            </div>
          </Suspense>
        )}

        {/* Remote video PiP — draggable while the board covers the stage.
            (video pointerEvents:none so the tile's drag handlers get the gesture) */}
        {showWhiteboard && (
          <DraggableVideoTile tileId="remote" defaultCorner="tl" defaultSize={{ w: 150, h: 110 }} label="Their video">
            <video ref={remotePipRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          </DraggableVideoTile>
        )}

        {/* Local self-view PiP — draggable/resizable, snaps to corners, persists */}
        <DraggableVideoTile tileId="self" defaultCorner="br" defaultSize={{ w: 160, h: 120 }} label="Your video">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }}
          />
          {!isVideoEnabled && (
            <div style={{ position: 'absolute', inset: 0, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <VideoOff size={28} color="rgba(255,255,255,0.4)" />
            </div>
          )}
        </DraggableVideoTile>

        {/* Reset the tuned tile layout back to default corners (only shown once moved) */}
        {layoutCustomized && (
          <button
            onClick={resetLayout}
            title="Reset video layout"
            style={{ position: 'absolute', top: `calc(16px + env(safe-area-inset-top, 0px))`, right: `calc(16px + env(safe-area-inset-right, 0px))`, zIndex: 12, padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Reset layout
          </button>
        )}

        {/* Connection status badge */}
        <div style={{ position: 'absolute', top: `calc(16px + env(safe-area-inset-top, 0px))`, left: `calc(16px + env(safe-area-inset-left, 0px))`, maxWidth: '55vw', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', zIndex: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {isConnected ? `Connected · ${otherUser?.name || 'User'}` : 'Waiting for peer...'}
          </span>
        </div>
      </div>

      {/* Controls bar — always visible at bottom. Sizes shrink on phone-portrait
          and the bar honors the home-indicator safe-area so nothing is clipped. */}
      <div style={{ flexShrink: 0, padding: `${btn.padY}px 16px calc(${btn.padY}px + env(safe-area-inset-bottom, 0px))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: btn.gap, background: 'rgba(0,0,0,0.92)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Mic */}
        <button
          onClick={toggleAudio}
          title={isAudioEnabled ? 'Mute mic' : 'Unmute mic'}
          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          style={{ ...ctrlBtn, background: isAudioEnabled ? 'rgba(255,255,255,0.12)' : '#ef4444' }}
        >
          {isAudioEnabled ? <Mic size={btn.icon} color="#fff" /> : <MicOff size={btn.icon} color="#fff" />}
        </button>

        {/* End call */}
        <button
          onClick={handleCallEnd}
          title="End call"
          aria-label="End call"
          style={{ width: btn.big, height: btn.big, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ff0076, #ff4b4b)', boxShadow: '0 4px 24px rgba(255,0,118,0.5)', border: 'none', cursor: 'pointer' }}
        >
          <PhoneOff size={btn.icon + 4} color="#fff" />
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          style={{ ...ctrlBtn, background: isVideoEnabled ? 'rgba(255,255,255,0.12)' : '#ef4444' }}
        >
          {isVideoEnabled ? <VideoIcon size={btn.icon} color="#fff" /> : <VideoOff size={btn.icon} color="#fff" />}
        </button>

        {/* Screen share (desktop web only — Android WebView has no getDisplayMedia) */}
        {canScreenShare() && (
          <button
            onClick={toggleScreenShare}
            title={isSharing ? 'Stop sharing screen' : 'Share screen'}
            aria-label={isSharing ? 'Stop sharing screen' : 'Share screen'}
            style={{ ...ctrlBtn, background: isSharing ? 'linear-gradient(135deg,#00c6ff,#7c3aed)' : 'rgba(255,255,255,0.12)' }}
          >
            <MonitorUp size={btn.icon} color="#fff" />
          </button>
        )}

        {/* Whiteboard */}
        <button
          onClick={() => setShowWhiteboard((s) => !s)}
          title={showWhiteboard ? 'Close whiteboard' : 'Open whiteboard'}
          aria-label={showWhiteboard ? 'Close whiteboard' : 'Open whiteboard'}
          style={{ ...ctrlBtn, background: showWhiteboard ? 'linear-gradient(135deg,#00c6ff,#7c3aed)' : 'rgba(255,255,255,0.12)' }}
        >
          <PenTool size={btn.icon} color="#fff" />
        </button>
      </div>
    </div>
  );
};

/* ── Status icon ── */
const CallStatusIcon = ({ status }) => {
  const map = {
    accepted: <Phone size={14} className="text-green-400" />,
    ringing:  <PhoneIncoming size={14} className="text-amber" />,
    missed:   <PhoneMissed size={14} className="text-danger" />,
    declined: <PhoneMissed size={14} className="text-danger" />,
    ended:    <PhoneOff size={14} className="text-text-muted" />,
  };
  return map[status] || <Phone size={14} className="text-text-muted" />;
};

/* ── Main page ── */
const VideoCall = () => {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useAuthStore();
  const { addToast } = useUIStore();
  const { openRatingModal, notifyUserOffline } = useNotificationStore();
  const [activeRoom, setActiveRoom] = useState(roomId || null);
  const [currentOtherUser, setCurrentOtherUser] = useState(location.state?.otherUser || null);
  const [isCallerState, setIsCallerState] = useState(location.state?.isCaller || false);
  const [autoBoard, setAutoBoard] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  /* Fetch call history */
  const queryClient = useQueryClient();
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['call-history'],
    queryFn: () => api.get('/video/history').then(r => r.data),
    refetchInterval: 3000, // Update in real-time
  });
  const calls = historyData?.calls || [];

  /* Deletion state */
  const [confirmDelete, setConfirmDelete] = useState(null); // call pending single delete
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const patchCalls = (updater) =>
    queryClient.setQueryData(['call-history'], (old) =>
      old ? { ...old, calls: updater(old.calls || []) } : old
    );

  const handleDeleteCall = async () => {
    if (!confirmDelete) return;
    const callId = confirmDelete._id;
    const prev = queryClient.getQueryData(['call-history']);
    setIsDeleting(true);
    patchCalls((list) => list.filter(c => c._id !== callId)); // optimistic
    try {
      await api.delete(`/video/history/${callId}`);
      addToast('Call deleted', 'success');
      setConfirmDelete(null);
    } catch {
      queryClient.setQueryData(['call-history'], prev); // rollback
      addToast('Failed to delete call', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    const prev = queryClient.getQueryData(['call-history']);
    setIsDeleting(true);
    patchCalls(() => []); // optimistic
    try {
      await api.delete('/video/history');
      addToast('Call history cleared', 'success');
      setConfirmClearAll(false);
    } catch {
      queryClient.setQueryData(['call-history'], prev); // rollback
      addToast('Failed to clear call history', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  /* Track online users via socket */
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com' : 'http://localhost:8000');
    const socket = io(socketUrl);

    socket.emit('register', user?._id);

    // Listen for online status updates
    socket.on('users-online', (userIds) => {
      setOnlineUsers(new Set(userIds));
    });

    socket.on('user-online', (userId) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    socket.on('user-offline-status', (userId) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  /* If a roomId was passed in the URL, go straight into the call */
  useEffect(() => { if (roomId) setActiveRoom(roomId); }, [roomId]);

  const handleEnd = (callDuration, otherUser) => {
    setActiveRoom(null);
    setAutoBoard(false);
    navigate('/video');

    // If call had duration and other user, open rating modal
    if (callDuration && callDuration > 5 && otherUser) {
      openRatingModal(otherUser, callDuration);
    } else {
      addToast('Call ended', 'info');
    }
  };

  const handleCallAgain = (other) => {
    // Check if other user is online
    const otherId = other?._id || other;
    const isOtherUserOnline = onlineUsers.has(otherId);

    if (!isOtherUserOnline) {
      notifyUserOffline(other?.name || 'User');
      return;
    }

    setCurrentOtherUser(other);
    setIsCallerState(true);
    setAutoBoard(false);
    setActiveRoom(Date.now().toString()); // Generate unique room ID
  };

  // Reopen a saved whiteboard from a past call (keyed by the call's roomName).
  // Works solo — no need for the other person to be online.
  const handleOpenBoard = (other, call) => {
    setCurrentOtherUser(other);
    setIsCallerState(false);
    setAutoBoard(true);
    setActiveRoom(call.roomName);
  };

  /* In an active call */
  if (activeRoom) {
    return <DirectVideoCall roomId={activeRoom} onEnd={handleEnd} otherUser={currentOtherUser} isCaller={isCallerState} autoBoard={autoBoard} />;
  }

  /* Lobby */
  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold"
          style={{ background: 'linear-gradient(135deg,#a855f7,#00c6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Video Calls
        </h1>
        <p className="text-text-muted mt-1 text-sm">Direct peer-to-peer video calls with camera and microphone.</p>
      </div>

      {/* Quick launch banner */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-accent/10 border border-accent/30 shadow-sm">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-text-primary text-lg flex items-center gap-2">
              <Video size={18} className="text-accent" /> Start a Call
            </p>
            <p className="text-text-muted text-sm mt-1">
              Go to <strong>Connections</strong> and click <strong>Call</strong> next to a friend.
            </p>
          </div>
        </div>
      </div>

      {/* Call history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-bold text-text-primary flex items-center gap-2">
            <Clock size={16} className="text-text-muted" /> Call History
          </h2>
          {calls.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-danger hover:bg-danger/10 border border-border-subtle transition-all"
              aria-label="Clear all call history"
            >
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>

        {isLoading ? (
          <VideoCallHistorySkeleton count={4} />
        ) : calls.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-surface border border-dashed border-border-subtle">
            <Video size={32} className="mx-auto text-border-subtle mb-3" />
            <p className="text-text-muted text-sm">No calls yet. Connect with someone and start a video call.</p>
          </div>
        ) : (
          calls.map((call, i) => {
            const isCaller  = call.caller?._id === user?._id || call.caller === user?._id;
            const other     = isCaller ? call.receiver : call.caller;
            const otherName = other?.name || 'Unknown';
            const otherId   = other?._id || other;
            const isOtherOnline = onlineUsers.has(otherId);
            
            return (
              <motion.div key={call._id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="skill-card p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={otherName} url={other?.avatar} size="md" userId={otherId} />
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary text-sm truncate">{otherName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CallStatusIcon status={call.status} />
                      <span className="text-xs text-text-muted capitalize">{call.status}</span>
                      {call.duration > 0 && <span className="text-xs text-text-muted">· {Math.round(call.duration / 60)}m</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">
                    {call.createdAt ? formatDistanceToNow(new Date(call.createdAt), { addSuffix: true }) : ''}
                  </span>
                  {(call.status === 'ended' || call.status === 'accepted') && (
                    <>
                      <button
                        onClick={() => handleOpenBoard(other, call)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border border-border-subtle text-text-secondary hover:text-accent hover:border-accent/40"
                        title="Open the whiteboard from this session"
                      >
                        <PenTool size={12} /> Board
                      </button>
                      <button
                        onClick={() => handleCallAgain(other)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative bg-accent text-text-on-accent hover:brightness-110 shadow-sm"
                      >
                        <Video size={12} /> Call Again
                        {!isOtherOnline && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" title="User offline" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setConfirmDelete(call)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all flex-shrink-0"
                    title="Delete call"
                    aria-label={`Delete call with ${otherName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Confirm: delete a single call entry */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => { if (!isDeleting) setConfirmDelete(null); }}
        onConfirm={handleDeleteCall}
        title="Delete call?"
        description="This removes the call from your history. The other person keeps their own copy."
        confirmLabel="Delete"
        isLoading={isDeleting}
      />

      {/* Confirm: clear all call history */}
      <ConfirmDialog
        isOpen={confirmClearAll}
        onClose={() => { if (!isDeleting) setConfirmClearAll(false); }}
        onConfirm={handleClearAll}
        title="Clear all call history?"
        description="This removes every call from your history. This cannot be undone."
        confirmLabel="Clear all"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default VideoCall;
