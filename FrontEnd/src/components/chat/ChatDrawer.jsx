import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle, Search, ArrowLeft, Check, CheckCheck, Clock } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../common/Avatar';
import useSocket from '../../hooks/useSocket';

const formatTimestamp = (date) => {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM HH:mm');
};

// ──────────────────────────────────────────────────────
// Conversation List (sidebar)
// ──────────────────────────────────────────────────────
const ConversationList = ({ onSelect, selectedId }) => {
  const [search, setSearch] = useState('');
  const { data: convos = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then(r => r.data),
    refetchInterval: 15000,
  });

  const filtered = convos.filter(c =>
    c.user?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-white/8 flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-glass w-full pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30"
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-white/30 text-sm">
            <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin mr-2"></div>
            Loading…
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/5 mb-2">
              <MessageCircle size={24} className="text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/50">No conversations yet</p>
            <p className="text-xs text-white/25 max-w-[200px]">Connect with others to start messaging</p>
          </div>
        )}
        {filtered.map(convo => {
          const isSelected = selectedId === convo.user._id;
          return (
            <button
              key={convo.user._id}
              onClick={() => onSelect(convo.user)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 relative ${
                isSelected 
                  ? 'bg-accent/10 border-l-2 border-accent' 
                  : 'hover:bg-white/4 border-l-2 border-transparent'
              }`}
              aria-label={`Chat with ${convo.user.name}`}
            >
              <div className="relative flex-shrink-0">
                <Avatar name={convo.user.name} url={convo.user.avatar} size="md" userId={convo.user._id} />
                {convo.unreadCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                    aria-label={`${convo.unreadCount} unread message${convo.unreadCount > 1 ? 's' : ''}`}
                  >
                    {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <p className={`font-semibold text-sm truncate ${convo.unreadCount > 0 ? 'text-white' : 'text-white/80'}`}>
                    {convo.user.name}
                  </p>
                  <span className="text-[10px] text-white/30 flex-shrink-0">
                    {convo.lastMessage?.createdAt ? formatTimestamp(convo.lastMessage.createdAt) : ''}
                  </span>
                </div>
                <p className={`text-xs truncate ${convo.unreadCount > 0 ? 'text-white/70 font-medium' : 'text-white/35'}`}>
                  {convo.lastMessage?.content || 'No messages yet'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────
// Chat Window (right panel)
// ──────────────────────────────────────────────────────
const ChatWindow = ({ otherUser, onBack }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', otherUser._id],
    queryFn: () => api.get(`/messages/${otherUser._id}`).then(r => r.data),
    enabled: !!otherUser._id,
  });

  // Connect socket and listen for new messages
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
    const io = require('socket.io-client');
    const sock = io.default ? io.default(socketUrl) : io(socketUrl);
    socketRef.current = sock;

    sock.emit('register', user?._id);
    sock.emit('mark-read', { senderId: otherUser._id });

    sock.on('new-message', (msg) => {
      const isRelevant =
        (msg.sender?._id === otherUser._id || msg.sender === otherUser._id) ||
        (msg.sender?._id === user?._id || msg.sender === user?._id);

      if (isRelevant) {
        queryClient.setQueryData(['messages', otherUser._id], (old = []) => {
          // Avoid duplicates
          if (old.some(m => m._id === msg._id)) return old;
          return [...old, msg];
        });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      }
    });

    return () => sock.disconnect();
  }, [otherUser._id, user?._id, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (content) => {
      // Use socket for real-time (optimistic)
      if (socketRef.current?.connected) {
        socketRef.current.emit('send-message', {
          receiverId: otherUser._id,
          content
        });
        return Promise.resolve(null); // socket handles it
      }
      // Fallback to REST
      return api.post(`/messages/${otherUser._id}`, { content }).then(r => r.data);
    },
    onError: () => {},
  });

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    sendMutation.mutate(content);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8 flex-shrink-0 bg-black/20">
        <button 
          onClick={onBack} 
          className="sm:hidden text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>
        <Avatar name={otherUser.name} url={otherUser.avatar} size="md" userId={otherUser._id} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white text-sm truncate">{otherUser.name}</p>
          <p className="text-[11px] text-white/40">Active now</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading && (
          <div className="flex justify-center py-12 text-white/30 text-sm">
            <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin mr-2"></div>
            Loading messages…
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5 mb-2">
              <MessageCircle size={28} className="text-white/20" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50 mb-1">No messages yet</p>
              <p className="text-xs text-white/30">Send a message to start the conversation</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
          const showAvatar = !isMe && (i === 0 || (messages[i - 1]?.sender?._id || messages[i - 1]?.sender) !== (msg.sender?._id || msg.sender));
          const isLastInGroup = i === messages.length - 1 || 
            (messages[i + 1]?.sender?._id || messages[i + 1]?.sender) !== (msg.sender?._id || msg.sender);
          
          return (
            <div key={msg._id || i} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-7 flex-shrink-0">
                  {showAvatar && <Avatar name={otherUser.name} url={otherUser.avatar} size="xs" userId={otherUser._id} />}
                </div>
              )}
              <div className={`max-w-[75%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isMe
                      ? `rounded-br-sm text-white shadow-lg ${isLastInGroup ? 'rounded-br-md' : ''}`
                      : `rounded-bl-sm text-white/90 ${isLastInGroup ? 'rounded-bl-md' : ''}`
                  }`}
                  style={isMe
                    ? { background: 'linear-gradient(135deg,#0072ff,#00c6ff)', boxShadow: '0 2px 8px rgba(0,114,255,0.3)' }
                    : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {msg.content}
                </div>
                {isLastInGroup && (
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] text-white/25">
                      {msg.createdAt ? formatTimestamp(msg.createdAt) : ''}
                    </span>
                    {isMe && (
                      <CheckCheck size={12} className="text-white/25" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-3 px-4 py-4 border-t border-white/8 flex-shrink-0 bg-black/20">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 input-glass px-4 py-3 text-sm text-white resize-none leading-relaxed placeholder:text-white/30"
          style={{ maxHeight: 120, overflowY: 'auto' }}
          aria-label="Message input"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-11 h-11 rounded-xl btn-gradient flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────
// Main Chat Drawer
// ──────────────────────────────────────────────────────
const ChatDrawer = ({ isOpen, onClose, initialUser = null }) => {
  const [selectedUser, setSelectedUser] = useState(initialUser);

  useEffect(() => {
    if (initialUser) setSelectedUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (!isOpen) setSelectedUser(null);
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[95] flex flex-col overflow-hidden shadow-2xl"
            style={{
              width: 'min(100vw, 480px)',
              background: 'rgba(8,10,20,0.98)',
              backdropFilter: 'blur(32px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 35, stiffness: 350 }}
            role="dialog"
            aria-label="Chat drawer"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0 bg-black/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10">
                  <MessageCircle size={16} className="text-accent" />
                </div>
                <h2 className="font-display font-bold text-white text-lg">Messages</h2>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body: two-panel layout on wider widths, single panel on mobile */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Conversation List */}
              <div className={`flex flex-col border-r border-white/8 bg-black/20 ${selectedUser ? 'hidden sm:flex sm:w-[45%]' : 'flex w-full sm:w-[45%]'}`}>
                <ConversationList
                  onSelect={setSelectedUser}
                  selectedId={selectedUser?._id}
                />
              </div>

              {/* Right: Chat Window */}
              <div className={`flex-1 flex flex-col ${!selectedUser ? 'hidden sm:flex' : 'flex'}`}>
                {selectedUser ? (
                  <ChatWindow
                    otherUser={selectedUser}
                    onBack={() => setSelectedUser(null)}
                  />
                ) : (
                  <div className="hidden sm:flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5">
                      <MessageCircle size={32} className="text-white/15" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/50 mb-1">Select a conversation</p>
                      <p className="text-xs text-white/30">Choose a contact to start chatting</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatDrawer;
