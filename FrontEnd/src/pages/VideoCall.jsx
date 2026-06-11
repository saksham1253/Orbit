import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PhoneOff, Video, Clock, Phone, PhoneIncoming, PhoneMissed, Mic, MicOff, VideoIcon, VideoOff, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useNotificationStore } from '../store/notificationStore';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../components/common/Avatar';
import { VideoCallHistorySkeleton } from '../components/skeletons';
import ConfirmDialog from '../components/common/ConfirmDialog';
import io from 'socket.io-client';

/* ── Direct WebRTC Video Call Component ── */
const DirectVideoCall = ({ roomId, onEnd, otherUser, isCaller }) => {
  const { user } = useAuthStore();
  const { addToast, setVideoCallActive } = useUIStore();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const callStartTimeRef = useRef(null);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    setVideoCallActive(true);
    return () => setVideoCallActive(false);
  }, [setVideoCallActive]);

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

        // 2. Connect to signaling server
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
        socketRef.current = io(socketUrl);

        // 3. Setup WebRTC
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        });

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
            callerName: user?.name
          });
        }

        // Handle signaling
        socketRef.current.on('user-joined', async ({ userId }) => {
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
          addToast('User left the call', 'info');
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
    // Calculate call duration
    let callDuration = 0;
    if (callStartTimeRef.current) {
      callDuration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    }

    // Emit call-ended event to trigger rating modal
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
              <div className="animate-spin" style={{ width: 60, height: 60, border: '4px solid rgba(255,255,255,0.15)', borderTopColor: '#00c6ff', borderRadius: '50%', margin: '0 auto 16px' }} />
              <p style={{ color: '#fff', fontSize: 18, marginBottom: 8, fontWeight: 600 }}>Connecting...</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Waiting for the other person to join</p>
            </div>
          </div>
        )}

        {/* Local video PiP — bottom-right */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, width: 160, height: 120, borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 10 }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          {!isVideoEnabled && (
            <div style={{ position: 'absolute', inset: 0, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <VideoOff size={28} color="rgba(255,255,255,0.4)" />
            </div>
          )}
        </div>

        {/* Connection status badge */}
        <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', zIndex: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {isConnected ? `Connected · ${otherUser?.name || 'User'}` : 'Waiting for peer...'}
          </span>
        </div>
      </div>

      {/* Controls bar — always visible at bottom */}
      <div style={{ flexShrink: 0, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, background: 'rgba(0,0,0,0.92)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Mic */}
        <button
          onClick={toggleAudio}
          title={isAudioEnabled ? 'Mute mic' : 'Unmute mic'}
          style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isAudioEnabled ? 'rgba(255,255,255,0.12)' : '#ef4444', border: '2px solid rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'background 0.2s' }}
        >
          {isAudioEnabled ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />}
        </button>

        {/* End call */}
        <button
          onClick={handleCallEnd}
          title="End call"
          style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ff0076, #ff4b4b)', boxShadow: '0 4px 24px rgba(255,0,118,0.5)', border: 'none', cursor: 'pointer' }}
        >
          <PhoneOff size={26} color="#fff" />
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isVideoEnabled ? 'rgba(255,255,255,0.12)' : '#ef4444', border: '2px solid rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'background 0.2s' }}
        >
          {isVideoEnabled ? <VideoIcon size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
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
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
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
    setActiveRoom(Date.now().toString()); // Generate unique room ID
  };

  /* In an active call */
  if (activeRoom) {
    return <DirectVideoCall roomId={activeRoom} onEnd={handleEnd} otherUser={currentOtherUser} isCaller={isCallerState} />;
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
                <div className="flex items-center gap-3">
                  <Avatar name={otherName} url={other?.avatar} size="md" userId={otherId} />
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{otherName}</p>
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
                    <button
                      onClick={() => handleCallAgain(other)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative bg-accent text-text-on-accent hover:brightness-110 shadow-sm"
                    >
                      <Video size={12} /> Call Again
                      {!isOtherOnline && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" title="User offline" />
                      )}
                    </button>
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
