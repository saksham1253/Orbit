import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle, Search, ArrowLeft, Check, CheckCheck, Maximize2, Minimize2, Bell, BellOff } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import Avatar from '../common/Avatar';
import { getSocket } from '../../services/socket';
import { ChatListSkeleton, ChatMessagesSkeleton } from '../skeletons';
import { requestNotificationPermission, showDesktopNotification, playNotificationSound, startTitleFlash, stopTitleFlash } from '../../utils/notifications';
import toast from 'react-hot-toast';

const formatTimestamp = (date) => {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM HH:mm');
};

const DateSeparator = ({ date }) => {
  const d = new Date(date);
  let label = format(d, 'MMMM d, yyyy');
  if (isToday(d)) label = 'Today';
  else if (isYesterday(d)) label = 'Yesterday';
  
  return (
    <div className="flex justify-center my-4">
      <div className="px-3 py-1 rounded-full bg-surface text-[11px] font-medium text-text-secondary border border-white/5 shadow-sm backdrop-blur-sm">
        {label}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────
// Conversation List (sidebar)
// ──────────────────────────────────────────────────────
const ConversationList = ({ onSelect, selectedId, onlineUsers }) => {
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
      <div className="p-4 border-b border-border-subtle flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-glass w-full pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:bg-surface-hover"
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading && <ChatListSkeleton count={6} />}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-surface mb-2">
              <MessageCircle size={24} className="text-white/20" />
            </div>
            <p className="text-sm font-medium text-text-secondary">No conversations yet</p>
            <p className="text-xs text-white/25 max-w-[200px]">Connect with others to start messaging</p>
          </div>
        )}
        {filtered.map(convo => {
          const isSelected = selectedId === convo.user._id;
          const isOnline = onlineUsers.has(convo.user._id);
          
          return (
            <button
              key={convo.user._id}
              onClick={() => onSelect(convo.user)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 relative rounded-lg ${
                isSelected 
                  ? 'bg-accent/10 border-2 border-accent shadow-lg' 
                  : 'hover:bg-white/4 border-2 border-border-subtle hover:border-border-subtle'
              }`}
              style={{
                marginBottom: '8px',
              }}
              aria-label={`Chat with ${convo.user.name}`}
            >
              <div className="relative flex-shrink-0">
                <Avatar name={convo.user.name} url={convo.user.avatar} size="md" userId={convo.user._id} />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0f111a] rounded-full z-10 animate-pulse-slow"></span>
                )}
                {convo.unreadCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent rounded-full flex items-center justify-center text-[10px] font-bold text-text-primary shadow-lg z-20"
                    aria-label={`${convo.unreadCount} unread message${convo.unreadCount > 1 ? 's' : ''}`}
                  >
                    {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <p className={`font-semibold text-sm truncate ${convo.unreadCount > 0 ? 'text-text-primary' : 'text-text-primary'}`}>
                    {convo.user.name}
                  </p>
                  <span className="text-[10px] text-text-muted flex-shrink-0">
                    {convo.lastMessage?.createdAt ? formatTimestamp(convo.lastMessage.createdAt) : ''}
                  </span>
                </div>
                <p className={`text-xs truncate ${convo.unreadCount > 0 ? 'text-text-secondary font-medium' : 'text-text-muted'}`}>
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
const ChatWindow = ({ otherUser, onBack, onlineUsers, isExpanded }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isNearBottomRef = useRef(true); // Track if user is scrolled near bottom

  const { data = {}, isLoading } = useQuery({
    queryKey: ['messages', otherUser._id],
    queryFn: () => api.get(`/messages/${otherUser._id}`).then(r => r.data),
    enabled: !!otherUser._id,
  });
  
  // Safely extract messages array, handling cursor-paginated objects vs legacy flat arrays
  const messages = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];

  const isOnline = onlineUsers.has(otherUser._id);

  // Connect socket and listen for new messages / typing
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    sock.emit('mark-read', { senderId: otherUser._id });

    const handleNewMessage = (msg) => {
      const isRelevant =
        (msg.sender?._id === otherUser._id || msg.sender === otherUser._id) ||
        (msg.sender?._id === user?._id || msg.sender === user?._id);

      if (isRelevant) {
        queryClient.setQueryData(['messages', otherUser._id], (oldData) => {
          // If structure is paginated { messages: [] }
          if (oldData && oldData.messages) {
            if (oldData.messages.some(m => m._id === msg._id)) return oldData;
            return { ...oldData, messages: [...oldData.messages, msg] };
          }
          // Legacy flat array
          const old = Array.isArray(oldData) ? oldData : [];
          if (old.some(m => m._id === msg._id)) return old;
          return [...old, msg];
        });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        
        // Mark as read immediately since we have the window open
        if ((msg.sender?._id || msg.sender) === otherUser._id) {
           sock.emit('mark-read', { senderId: otherUser._id });
        }
      }
    };

    const handleTypingStart = ({ senderId }) => {
      if (senderId === otherUser._id) setOtherUserTyping(true);
    };

    const handleTypingStop = ({ senderId }) => {
      if (senderId === otherUser._id) setOtherUserTyping(false);
    };

    sock.on('new-message', handleNewMessage);
    sock.on('typing-start', handleTypingStart);
    sock.on('typing-stop', handleTypingStop);

    return () => {
      sock.off('new-message', handleNewMessage);
      sock.off('typing-start', handleTypingStart);
      sock.off('typing-stop', handleTypingStop);
      // Clean up typing stop when leaving
      sock.emit('typing-stop', { receiverId: otherUser._id });
    };
  }, [otherUser._id, user?._id, queryClient]);

  // Smart scroll: Check if user is near bottom (passive listener for performance)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isNearBottomRef.current = distanceFromBottom < 150; // Within 150px of bottom
      
      // Hide pill when user scrolls near bottom
      if (isNearBottomRef.current && showNewMessagesPill) {
        setShowNewMessagesPill(false);
        setUnreadCount(0);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [showNewMessagesPill]);

  // Smart autoscroll: Only scroll if user is near bottom, otherwise show pill
  useEffect(() => {
    const prevMessageCount = useRef(messages.length);
    
    if (messages.length > prevMessageCount.current) {
      const newMessageCount = messages.length - prevMessageCount.current;
      
      if (isNearBottomRef.current) {
        // User is near bottom - smooth scroll to new message
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      } else {
        // User scrolled up - show "N new messages" pill
        setUnreadCount(prev => prev + newMessageCount);
        setShowNewMessagesPill(true);
      }
    }
    
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Scroll to bottom when typing indicator appears (only if near bottom)
  useEffect(() => {
    if (otherUserTyping && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [otherUserTyping]);

  const sendMutation = useMutation({
    mutationFn: (content) => {
      const sock = getSocket();
      if (sock?.connected) {
        sock.emit('send-message', {
          receiverId: otherUser._id,
          content
        });
        return Promise.resolve(null);
      }
      return api.post(`/messages/${otherUser._id}`, { content }).then(r => r.data);
    },
    onError: () => {},
  });

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    setIsTyping(false);
    
    const sock = getSocket();
    if (sock) sock.emit('typing-stop', { receiverId: otherUser._id });
    
    sendMutation.mutate(content);
    inputRef.current?.focus();
    
    // Ensure we scroll to bottom after sending (user action = explicit intent)
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleScrollToLatest = () => {
    setShowNewMessagesPill(false);
    setUnreadCount(0);
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    
    const sock = getSocket();
    if (!sock) return;

    if (!isTyping) {
      setIsTyping(true);
      sock.emit('typing-start', { receiverId: otherUser._id });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sock.emit('typing-stop', { receiverId: otherUser._id });
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border-subtle flex-shrink-0 bg-surface backdrop-blur-md">
        <button 
          onClick={onBack} 
          className="sm:hidden text-text-secondary hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-hover"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="relative">
          <Avatar name={otherUser.name} url={otherUser.avatar} size="md" userId={otherUser._id} />
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0a0c14] rounded-full z-10"></span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary text-sm truncate">{otherUser.name}</p>
          <p className={`text-[11px] font-medium ${isOnline ? 'text-green-400' : 'text-text-muted'}`}>
            {isOnline ? 'Active now' : (otherUser.lastSeen && !isNaN(new Date(otherUser.lastSeen).getTime()) ? `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeen))} ago` : 'Offline')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative">
        {isLoading && <ChatMessagesSkeleton />}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-surface mb-2 shadow-inner">
              <MessageCircle size={28} className="text-white/20" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary mb-1">No messages yet</p>
              <p className="text-xs text-text-muted">Send a message to start the conversation</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
          const showAvatar = !isMe && (i === 0 || (messages[i - 1]?.sender?._id || messages[i - 1]?.sender) !== (msg.sender?._id || msg.sender));
          const isLastInGroup = i === messages.length - 1 || 
            (messages[i + 1]?.sender?._id || messages[i + 1]?.sender) !== (msg.sender?._id || msg.sender);
            
          // Check if we need a date separator (safely handle missing/invalid dates)
          const currDate = msg.createdAt ? new Date(msg.createdAt) : null;
          const prevDate = messages[i-1]?.createdAt ? new Date(messages[i-1].createdAt) : null;
          const isValidDate = (d) => d && !isNaN(d.getTime());
          
          const showDate = i === 0 || (isValidDate(currDate) && isValidDate(prevDate) && !isSameDay(prevDate, currDate));
          
          return (
            <div key={msg._id || i}>
              {showDate && <DateSeparator date={msg.createdAt} />}
              <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} mt-1`}>
                {!isMe && (
                  <div className="w-7 flex-shrink-0">
                    {showAvatar ? <Avatar name={otherUser.name} url={otherUser.avatar} size="xs" userId={otherUser._id} /> : <div className="w-7"></div>}
                  </div>
                )}
                <div className={`max-w-[75%] ${isExpanded ? 'lg:max-w-[60%]' : 'sm:max-w-[70%]'} flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? `rounded-br-sm shadow-lg ${isLastInGroup ? 'rounded-br-md' : ''}`
                        : `rounded-bl-sm ${isLastInGroup ? 'rounded-bl-md' : ''}`
                    }`}
                    style={isMe
                      ? { 
                          background: 'var(--bubble-outgoing)', 
                          boxShadow: 'var(--send-button-shadow)',
                          color: '#ffffff'
                        }
                      : { 
                          background: 'var(--bubble-incoming)', 
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#ffffff'
                        }
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
                        msg.read ? <CheckCheck size={12} className="text-accent" /> : <Check size={12} className="text-white/25" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Typing Indicator */}
        <AnimatePresence>
          {otherUserTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-end gap-2 justify-start mt-2"
            >
              <div className="w-7 flex-shrink-0">
                <Avatar name={otherUser.name} url={otherUser.avatar} size="xs" userId={otherUser._id} />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-surface border border-white/5 flex gap-1 items-center h-[38px]">
                <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
        
        {/* "N new messages" pill - shows when user scrolled up */}
        {showNewMessagesPill && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={handleScrollToLatest}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
            style={{
              background: 'var(--accent-1)',
              color: '#ffffff',
              zIndex: 10,
            }}
          >
            <span className="text-sm font-medium">
              {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-3 px-4 py-4 border-t border-border-subtle flex-shrink-0 bg-surface backdrop-blur-md">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 input-glass px-4 py-3 text-sm text-text-primary resize-none leading-relaxed placeholder:text-text-muted transition-all focus:bg-surface-hover"
          style={{ maxHeight: 120, overflowY: 'auto' }}
          aria-label="Message input"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'var(--send-button-bg)',
            boxShadow: 'var(--send-button-shadow)',
            color: '#ffffff',
          }}
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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  // Feature states
  const [drawerWidth, setDrawerWidth] = useState(() => {
    const saved = localStorage.getItem('chat_drawer_width');
    return saved ? parseInt(saved, 10) : 800; // Default to expanded view for better initial experience
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('chat_notify') !== 'false');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // Track open state strictly for the socket listener to know what to suppress
  const isOpenRef = useRef(isOpen);
  const selectedUserIdRef = useRef(selectedUser?._id);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  
  useEffect(() => {
    selectedUserIdRef.current = selectedUser?._id;
  }, [selectedUser]);

  useEffect(() => {
    if (initialUser) setSelectedUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (!isOpen) setSelectedUser(null);
  }, [isOpen]);
  
  const handleToggleExpand = () => {
    const nextWidth = drawerWidth >= 800 ? 440 : 800;
    setDrawerWidth(nextWidth);
    localStorage.setItem('chat_drawer_width', nextWidth);
  };
  
  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        localStorage.setItem('chat_notify', 'true');
        toast.success('Desktop notifications enabled');
      } else {
        toast.error('Notification permission denied by browser');
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('chat_notify', 'false');
      toast.success('Desktop notifications disabled');
    }
  };

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

  // Global socket listener for notifications and online presence
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    const handleUsersOnline = (usersArray) => setOnlineUsers(new Set(usersArray));
    const handleUserOnline = (userId) => setOnlineUsers(prev => new Set(prev).add(userId));
    const handleUserOffline = (userId) => setOnlineUsers(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });

    const handleGlobalNewMessage = (msg) => {
      // Is it for us?
      if (msg.receiver?._id !== user?._id && msg.receiver !== user?._id) return;
      
      const senderId = msg.sender?._id || msg.sender;
      
      // If we are currently looking at this conversation, do nothing (handled by ChatWindow)
      if (isOpenRef.current && selectedUserIdRef.current === senderId) return;

      // Handle unfocused notifications
      if (notificationsEnabled) {
        if (document.hidden) {
          showDesktopNotification(`New message from ${msg.sender?.name || 'Someone'}`, {
            body: msg.content,
          });
          startTitleFlash();
        } else {
          // Show in-app toast if not looking at this chat
          toast.custom((t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-surface border border-border-subtle shadow-2xl rounded-2xl pointer-events-auto flex cursor-pointer hover:bg-surface transition-colors`}
              onClick={() => {
                toast.dismiss(t.id);
                // We'd ideally open the chat here, but this listener lives inside ChatDrawer anyway.
                // Assuming ChatDrawer is always mounted but hidden.
                setSelectedUser(msg.sender);
              }}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <Avatar name={msg.sender?.name} url={msg.sender?.avatar} size="sm" userId={senderId} />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-text-primary">{msg.sender?.name}</p>
                    <p className="mt-1 text-sm text-text-secondary truncate">{msg.content}</p>
                  </div>
                </div>
              </div>
            </div>
          ));
        }
        playNotificationSound();
      }
      
      // Invalidate queries to update unread badges
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    };

    sock.on('users-online', handleUsersOnline);
    sock.on('user-online', handleUserOnline);
    sock.on('user-offline-status', handleUserOffline);
    sock.on('new-message', handleGlobalNewMessage);

    const handleVisibilityChange = () => {
      if (!document.hidden) stopTitleFlash();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      sock.off('users-online', handleUsersOnline);
      sock.off('user-online', handleUserOnline);
      sock.off('user-offline-status', handleUserOffline);
      sock.off('new-message', handleGlobalNewMessage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTitleFlash();
    };
  }, [user?._id, notificationsEnabled, queryClient]);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Handle Drag to Resize
  const handleMouseDown = useCallback((e) => {
    // Only allow resizing if on desktop
    if (window.innerWidth < 640) return;
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 350) newWidth = 350;
      if (newWidth > window.innerWidth - 50) newWidth = window.innerWidth - 50;
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = 'unset';
        document.body.style.userSelect = 'unset';
        localStorage.setItem('chat_drawer_width', drawerWidth);
      }
    };

    if (isOpen) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, drawerWidth]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm"
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
              width: window.innerWidth < 640 ? '100vw' : `${drawerWidth}px`,
              background: 'var(--bg-app)',
              backdropFilter: 'blur(32px)',
              borderLeft: '1px solid var(--border-subtle)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 35, stiffness: 350 }}
            role="dialog"
            aria-modal="true"
            aria-label="Messages"
          >
            {/* Drag Resize Handle */}
            <div 
              onMouseDown={handleMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/50 active:bg-accent z-50 transition-colors hidden sm:block"
            />

            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0 bg-surface">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 border border-accent/20">
                  <MessageCircle size={16} className="text-accent" />
                </div>
                <h2 className="font-display font-bold text-text-primary text-lg">Messages</h2>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={handleToggleNotifications}
                  className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
                  title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
                  aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
                >
                  {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                </button>
                <button
                  onClick={handleToggleExpand}
                  className="hidden sm:flex p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
                  title={drawerWidth >= 800 ? "Collapse" : "Expand"}
                  aria-label={drawerWidth >= 800 ? "Collapse" : "Expand"}
                >
                  {drawerWidth >= 800 ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button 
                  onClick={onClose} 
                  className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all ml-1"
                  aria-label="Close messages"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body: two-panel layout on wider widths, single panel on mobile */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Conversation List */}
              <div 
                className={`flex flex-col border-r border-border-subtle bg-surface 
                ${selectedUser ? 'hidden sm:flex' : 'flex w-full'}
                ${drawerWidth >= 700 ? 'sm:w-[320px] flex-shrink-0' : 'sm:w-[40%]'}`}
              >
                <ConversationList
                  onSelect={setSelectedUser}
                  selectedId={selectedUser?._id}
                  onlineUsers={onlineUsers}
                />
              </div>

              {/* Right: Chat Window */}
              <div className={`flex-1 flex flex-col ${!selectedUser ? 'hidden sm:flex' : 'flex'}`}>
                {selectedUser ? (
                  <ChatWindow
                    otherUser={selectedUser}
                    onBack={() => setSelectedUser(null)}
                    onlineUsers={onlineUsers}
                    isExpanded={drawerWidth >= 700}
                  />
                ) : (
                  <div className="hidden sm:flex flex-col items-center justify-center h-full gap-4 text-center px-6 bg-background">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-surface shadow-inner">
                      <MessageCircle size={32} className="text-white/15" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary mb-1">Select a conversation</p>
                      <p className="text-xs text-text-muted">Choose a contact to start chatting</p>
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
