import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PhoneOff, Video, Clock, Phone, PhoneIncoming, PhoneMissed, Mic, MicOff, VideoIcon, VideoOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useNotificationStore } from '../store/notificationStore';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../components/common/Avatar';
import io from 'socket.io-client';

/* ── Direct WebRTC Video Call Component ── */
const DirectVideoCall = ({ roomId, onEnd, otherUser, isCaller }) => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  
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
    let mounted = true;

    const initializeCall = async () => {
      try {
        // 1. Get user media (camera + microphone)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
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
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Remote video (large) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Connecting overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">Connecting...</p>
              <p className="text-white/50 text-sm mt-2">Waiting for camera permissions</p>
            </div>
          </div>
        )}

        {/* Local video (small, corner) */}
        <div className="absolute top-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <VideoOff size={32} className="text-white/50" />
            </div>
          )}
        </div>

        {/* Connection status */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-amber'}`} />
          <span className="text-white text-sm font-medium">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Controls (bottom) */}
      <div className="p-6 flex items-center justify-center gap-4"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
        {/* Mic toggle */}
        <button
          onClick={toggleAudio}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
          style={{
            background: isAudioEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,75,75,0.8)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}
        >
          {isAudioEnabled ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-white" />}
        </button>

        {/* End call */}
        <button
          onClick={handleCallEnd}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
          style={{
            background: 'linear-gradient(135deg, #ff0076, #ff4b4b)',
            boxShadow: '0 4px 20px rgba(255,0,118,0.4)'
          }}
        >
          <PhoneOff size={28} className="text-white" />
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
          style={{
            background: isVideoEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,75,75,0.8)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}
        >
          {isVideoEnabled ? <VideoIcon size={24} className="text-white" /> : <VideoOff size={24} className="text-white" />}
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
    ended:    <PhoneOff size={14} className="text-white/40" />,
  };
  return map[status] || <Phone size={14} className="text-white/40" />;
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
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['call-history'],
    queryFn: () => api.get('/video/history').then(r => r.data),
    staleTime: 30_000,
  });
  const calls = historyData?.calls || [];

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
        <p className="text-white/40 mt-1 text-sm">Direct peer-to-peer video calls with camera and microphone.</p>
      </div>

      {/* Quick launch banner */}
      <div className="relative overflow-hidden p-6 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(0,198,255,0.1))', border: '1px solid rgba(124,58,237,0.3)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(124,58,237,0.2),transparent 70%)', filter: 'blur(30px)' }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white text-lg flex items-center gap-2">
              <Video size={18} className="text-purple-400" /> Start a Call
            </p>
            <p className="text-white/45 text-sm mt-1">
              Go to <strong>Connections</strong> and click <strong>Call</strong> next to a friend.
            </p>
          </div>
        </div>
      </div>

      {/* Call history */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Clock size={16} className="text-white/40" /> Call History
        </h2>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
          </div>
        ) : calls.length === 0 ? (
          <div className="py-12 text-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <Video size={32} className="mx-auto text-white/10 mb-3" />
            <p className="text-white/35 text-sm">No calls yet. Connect with someone and start a video call.</p>
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
                    <p className="font-semibold text-white text-sm">{otherName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CallStatusIcon status={call.status} />
                      <span className="text-xs text-white/35 capitalize">{call.status}</span>
                      {call.duration > 0 && <span className="text-xs text-white/25">· {Math.round(call.duration / 60)}m</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30">
                    {call.createdAt ? formatDistanceToNow(new Date(call.createdAt), { addSuffix: true }) : ''}
                  </span>
                  {(call.status === 'ended' || call.status === 'accepted') && (
                    <button
                      onClick={() => handleCallAgain(other)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative"
                      style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a855f7' }}
                    >
                      <Video size={12} /> Call Again
                      {!isOtherOnline && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" title="User offline" />
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VideoCall;
