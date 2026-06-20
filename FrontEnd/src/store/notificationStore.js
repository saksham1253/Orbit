import { create } from 'zustand';

/**
 * Notification Store - Manages all acknowledgment popups
 * Centralized state for notifications with sounds and animations
 */

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  ratingModal: null, // { isOpen, otherUser, callDuration }

  // Add a new notification
  addNotification: (notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      ...notification,
      timestamp: new Date(),
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-dismiss after duration (default 5 seconds)
    const duration = notification.duration || 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().dismissNotification(id);
      }, duration);
    }

    return id;
  },

  // Dismiss a notification
  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  // Clear all notifications
  clearAllNotifications: () => {
    set({ notifications: [] });
  },

  // Handle notification action (e.g., Accept, Decline)
  handleNotificationAction: (id, handler) => {
    if (handler && typeof handler === 'function') {
      handler();
    }
    get().dismissNotification(id);
  },

  // ──────── Rating Modal ────────
  openRatingModal: (otherUser, callDuration) => {
    set({
      ratingModal: {
        isOpen: true,
        otherUser,
        callDuration,
      },
    });
  },

  closeRatingModal: () => {
    set({
      ratingModal: null,
    });
  },

  // ──────── Helper Methods for Specific Notifications ────────
  // Perfect (reciprocal) match — fired to BOTH people once per pair (v7 §3).
  // Framed from the recipient's POV: what THEY can learn / teach.
  notifyPerfectMatch: (otherUser, { youTeach, youLearn } = {}) => {
    const name = otherUser?.name || 'Someone';
    const learn = youLearn ? `learn ${youLearn} from ${name}` : `connect with ${name}`;
    const teach = youTeach ? ` and teach them ${youTeach}` : '';
    get().addNotification({
      type: 'perfect_match',
      title: 'Perfect Match Found!',
      message: `You can ${learn}${teach}.`,
      actions: [
        {
          label: 'View Profile',
          primary: true,
          handler: () => {
            window.location.href = `/profile?userId=${otherUser?._id}`;
          },
        },
        {
          label: 'Find Matches',
          handler: () => {
            window.location.href = '/matches';
          },
        },
      ],
      duration: 9000,
    });
  },

  notifySkillMatch: (matchedUser, skill) => {
    get().addNotification({
      type: 'match',
      title: 'Perfect Match Found!',
      message: `${matchedUser.name} wants to learn ${skill.skillOffered} and can teach ${skill.skillWanted}`,
      actions: [
        {
          label: 'View Profile',
          primary: true,
          handler: () => {
            window.location.href = `/profile?userId=${matchedUser._id}`;
          },
        },
      ],
      duration: 8000,
    });
  },

  notifyConnectionRequest: (requester, skill) => {
    get().addNotification({
      type: 'connection_request',
      title: 'New Connection Request',
      message: `${requester.name} wants to connect with you for ${skill.skillOffered}`,
      actions: [
        {
          label: 'View Requests',
          primary: true,
          handler: () => {
            window.location.href = '/connections?tab=requests';
          },
        },
      ],
      duration: 10000,
    });
  },

  notifyConnectionAccepted: (accepterName) => {
    get().addNotification({
      type: 'connection_accepted',
      title: 'Request Accepted!',
      message: `${accepterName} accepted your connection request. You can now call them!`,
      actions: [
        {
          label: 'View Connections',
          primary: true,
          handler: () => {
            window.location.href = '/connections';
          },
        },
      ],
      duration: 8000,
    });
  },

  notifyUserOffline: (userName) => {
    get().addNotification({
      type: 'user_offline',
      title: 'User Offline',
      message: `${userName} is currently offline. Try calling them later.`,
      duration: 5000,
    });
  },

  notifyIncomingCall: (callerName, roomId) => {
    get().addNotification({
      type: 'incoming_call',
      title: 'Incoming Call',
      message: `${callerName} is calling you for a video session...`,
      actions: [
        {
          label: 'Accept Call',
          primary: true,
          handler: () => {
            window.location.href = `/call/${roomId}`;
          },
        },
      ],
      duration: 30000, // Ring for 30 seconds
    });
  },

  notifyCallEnded: (otherUser, callDuration) => {
    // Show notification first
    get().addNotification({
      type: 'call_ended',
      title: 'Call Ended',
      message: `Your call with ${otherUser.name} has ended. Please rate your experience.`,
      duration: 3000,
    });

    // Open rating modal after short delay
    setTimeout(() => {
      get().openRatingModal(otherUser, callDuration);
    }, 500);
  },
}));
