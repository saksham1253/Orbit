/**
 * Sound Manager - Motivational Learning Experience
 * Uplifting, inspiring sounds that match peer-to-peer learning platform
 */

class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.15; // Moderate volume for motivational sounds
    this.musicEnabled = false; // Music disabled by default
    this.ambientAudio = null;  // HTMLAudioElement instance
    
    // Load enabled state from localStorage
    const savedState = localStorage.getItem('skillswap-sounds-enabled');
    if (savedState !== null) {
      this.enabled = savedState === 'true';
    }

    const savedMusicState = localStorage.getItem('skillswap-music-enabled');
    if (savedMusicState !== null) {
      this.musicEnabled = savedMusicState === 'true';
    }
  }

  // Play the uploaded ambient track via HTMLAudioElement
  startAmbientMusic() {
    if (!this.musicEnabled || this.ambientAudio) return;

    try {
      this.ambientAudio = new Audio('/audio/Equatorial Complex.mp3');
      this.ambientAudio.loop = true;
      this.ambientAudio.volume = 0.5; // Gentle, non-intrusive level
      this.ambientAudio.play().catch(() => {
        // Browser autoplay policy: silently ignored — will play on next user gesture
      });
    } catch (error) {
      console.warn('Failed to start ambient music:', error);
    }
  }

  stopAmbientMusic() {
    if (!this.ambientAudio) return;

    try {
      this.ambientAudio.pause();
      this.ambientAudio.src = ''; // Release the resource
      this.ambientAudio = null;
    } catch (error) {
      console.warn('Failed to stop ambient music:', error);
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('skillswap-music-enabled', this.musicEnabled.toString());
    
    if (this.musicEnabled) {
      this.startAmbientMusic();
    } else {
      this.stopAmbientMusic();
    }
    
    return this.musicEnabled;
  }

  isMusicEnabled() {
    return this.musicEnabled;
  }

  // Generate motivational sounds matching peer-to-peer learning platform
  createSound(type) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    // Add filter for warmer, more pleasant tones
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'click':
        // Confident, positive click (like confirming a learning action)
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 - bright and clear
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.06);
        gainNode.gain.setValueAtTime(this.volume * 0.6, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
        
      case 'hover':
        // Subtle anticipation sound (encouraging exploration)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, audioContext.currentTime); // E5 - friendly
        gainNode.gain.setValueAtTime(this.volume * 0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.04);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.04);
        break;
        
      case 'success':
        // Achievement sound - uplifting major chord arpeggio
        // C-E-G major chord (victory feeling)
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        const osc3 = audioContext.createOscillator();
        const gain3 = audioContext.createGain();
        
        oscillator.type = 'triangle';
        osc2.type = 'triangle';
        osc3.type = 'triangle';
        
        // C6 note
        oscillator.frequency.setValueAtTime(1046.5, audioContext.currentTime);
        gainNode.gain.setValueAtTime(this.volume * 0.7, audioContext.currentTime);
        
        // E6 note (after 60ms)
        osc2.frequency.setValueAtTime(1318.5, audioContext.currentTime + 0.06);
        gain2.gain.setValueAtTime(this.volume * 0.65, audioContext.currentTime + 0.06);
        osc2.connect(filter);
        gain2.connect(audioContext.destination);
        
        // G6 note (after 120ms) - triumphant finish
        osc3.frequency.setValueAtTime(1568.0, audioContext.currentTime + 0.12);
        gain3.gain.setValueAtTime(this.volume * 0.6, audioContext.currentTime + 0.12);
        osc3.connect(filter);
        gain3.connect(audioContext.destination);
        
        // Fade out all notes together
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
        gain3.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
        
        oscillator.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime + 0.06);
        osc3.start(audioContext.currentTime + 0.12);
        
        oscillator.stop(audioContext.currentTime + 0.35);
        osc2.stop(audioContext.currentTime + 0.35);
        osc3.stop(audioContext.currentTime + 0.35);
        break;
        
      case 'error':
        // Gentle nudge (not harsh) - encouraging retry
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(392, audioContext.currentTime); // G4
        oscillator.frequency.exponentialRampToValueAtTime(349, audioContext.currentTime + 0.1); // F4
        gainNode.gain.setValueAtTime(this.volume * 0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.18);
        break;
        
      case 'notification':
        // Friendly attention sound - "new learning opportunity!"
        oscillator.type = 'triangle';
        // Two-tone chime: E5 -> G5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.08); // G5
        gainNode.gain.setValueAtTime(this.volume * 0.65, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
        
      case 'open':
        // Modal opening - welcoming ascending sound
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(783.99, audioContext.currentTime + 0.12); // G5
        gainNode.gain.setValueAtTime(this.volume * 0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
        
      case 'close':
        // Modal closing - satisfying descending sound
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime); // G5
        oscillator.frequency.exponentialRampToValueAtTime(523.25, audioContext.currentTime + 0.12); // C5
        gainNode.gain.setValueAtTime(this.volume * 0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
        
      default:
        oscillator.stop(audioContext.currentTime);
    }
  }

  play(soundType) {
    if (!this.enabled) return;
    
    try {
      this.createSound(soundType);
    } catch (error) {
      console.warn('Sound playback failed:', error);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('skillswap-sounds-enabled', this.enabled.toString());
    return this.enabled;
  }

  setVolume(newVolume) {
    this.volume = Math.max(0, Math.min(1, newVolume));
  }

  isEnabled() {
    return this.enabled;
  }
}

// Create singleton instance
const soundManager = new SoundManager();

export default soundManager;

// Helper hooks for React components
export const useSound = () => {
  const playClick = () => soundManager.play('click');
  const playHover = () => soundManager.play('hover');
  const playSuccess = () => soundManager.play('success');
  const playError = () => soundManager.play('error');
  const playNotification = () => soundManager.play('notification');
  const playOpen = () => soundManager.play('open');
  const playClose = () => soundManager.play('close');

  return {
    playClick,
    playHover,
    playSuccess,
    playError,
    playNotification,
    playOpen,
    playClose,
    toggle: () => soundManager.toggle(),
    isEnabled: () => soundManager.isEnabled(),
    toggleMusic: () => soundManager.toggleMusic(),
    isMusicEnabled: () => soundManager.isMusicEnabled(),
    startMusic: () => soundManager.startAmbientMusic(),
    stopMusic: () => soundManager.stopAmbientMusic(),
  };
};
