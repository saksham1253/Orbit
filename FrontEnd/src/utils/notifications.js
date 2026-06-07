// FrontEnd/src/utils/notifications.js

let originalTitle = document.title;
let titleInterval = null;

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  
  if (Notification.permission === "granted") return true;
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
};

export const showDesktopNotification = (title, options = {}) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!document.hidden) return; // Only show if tab is backgrounded
  
  const notification = new Notification(title, {
    icon: '/vite.svg', // Fallback icon
    ...options
  });
  
  notification.onclick = function() {
    window.focus();
    this.close();
  };
  
  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
};

export const playNotificationSound = () => {
  // Simple beep sound using Web Audio API to avoid needing an asset file
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    console.error("Audio playback failed", err);
  }
};

export const startTitleFlash = (message = "New Message!") => {
  if (titleInterval) return;
  originalTitle = document.title;
  let isOriginal = true;
  
  titleInterval = setInterval(() => {
    document.title = isOriginal ? `(1) ${message}` : originalTitle;
    isOriginal = !isOriginal;
  }, 1000);
};

export const stopTitleFlash = () => {
  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
    document.title = originalTitle;
  }
};
