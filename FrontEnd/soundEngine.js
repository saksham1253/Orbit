// ═══════════════════════════════════════════════════════════════
//  SkillSwap Sound Engine — Procedural Audio via Web Audio API
//  Zero external files. Every sound is synthesized in real-time.
// ═══════════════════════════════════════════════════════════════

const SFX = (() => {
    let ctx = null;
    let masterGain = null;
    let isMuted = localStorage.getItem('sfx_muted') === 'true';
    let ambientNodes = null;
    let ringInterval = null;

    // Lazy-init AudioContext (must be triggered by user gesture)
    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = isMuted ? 0 : 1;
            masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function getMaster() {
        getCtx();
        return masterGain;
    }

    // ─── UTILITY: Create an oscillator with envelope ───
    function playTone(freq, type = 'sine', duration = 0.1, volume = 0.15, delay = 0) {
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + delay);
        gain.gain.setValueAtTime(0, c.currentTime + delay);
        gain.gain.linearRampToValueAtTime(volume, c.currentTime + delay + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(getMaster());
        osc.start(c.currentTime + delay);
        osc.stop(c.currentTime + delay + duration + 0.05);
    }

    // ─── UTILITY: Filtered noise burst ───
    function noiseShot(duration = 0.15, volume = 0.05, filterFreq = 3000, filterType = 'bandpass', delay = 0) {
        const c = getCtx();
        const bufferSize = c.sampleRate * duration;
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const source = c.createBufferSource();
        source.buffer = buffer;
        const filter = c.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, c.currentTime);
        filter.Q.setValueAtTime(1, c.currentTime);
        const gain = c.createGain();
        gain.gain.setValueAtTime(0, c.currentTime + delay);
        gain.gain.linearRampToValueAtTime(volume, c.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(getMaster());
        source.start(c.currentTime + delay);
        source.stop(c.currentTime + delay + duration + 0.05);
    }

    // ═══════════════════════════════════════════════════
    //  SOUND LIBRARY
    // ═══════════════════════════════════════════════════

    return {
        // ─── CLICK: Crisp glass tap ───
        click() {
            if (isMuted) return;
            playTone(800, 'sine', 0.08, 0.1);
            playTone(1200, 'sine', 0.04, 0.04);
        },

        // ─── HOVER: Ultra-subtle shimmer ───
        hover() {
            if (isMuted) return;
            playTone(2400, 'sine', 0.04, 0.02);
        },

        // ─── TAB SWITCH: Smooth ascending slide ───
        tabSwitch() {
            if (isMuted) return;
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.12);
            gain.gain.setValueAtTime(0.08, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(getMaster());
            osc.start(c.currentTime);
            osc.stop(c.currentTime + 0.2);
            // Subtle noise whoosh
            noiseShot(0.1, 0.02, 4000, 'highpass');
        },

        // ─── TOGGLE ON: Rising two-note chime ───
        toggleOn() {
            if (isMuted) return;
            playTone(523, 'sine', 0.12, 0.1, 0);      // C5
            playTone(659, 'sine', 0.15, 0.08, 0.08);   // E5
        },

        // ─── TOGGLE OFF: Descending two-note chime ───
        toggleOff() {
            if (isMuted) return;
            playTone(659, 'sine', 0.12, 0.1, 0);       // E5
            playTone(523, 'sine', 0.15, 0.08, 0.08);   // C5
        },

        // ─── SUCCESS: Warm 3-note ascending arpeggio (C→E→G) ───
        success() {
            if (isMuted) return;
            playTone(523, 'sine', 0.2, 0.12, 0);       // C5
            playTone(659, 'sine', 0.2, 0.1, 0.1);      // E5
            playTone(784, 'sine', 0.35, 0.08, 0.2);    // G5
            // Sparkle layer
            playTone(1568, 'sine', 0.15, 0.03, 0.25);  // G6 shimmer
        },

        // ─── ERROR: Low rumble + discordant buzz ───
        error() {
            if (isMuted) return;
            playTone(150, 'sawtooth', 0.25, 0.08);
            playTone(180, 'square', 0.2, 0.04, 0.02);
            noiseShot(0.15, 0.03, 500, 'lowpass');
        },

        // ─── WARNING: Alert klaxon ───
        warning() {
            if (isMuted) return;
            playTone(440, 'square', 0.15, 0.1, 0);
            playTone(380, 'square', 0.15, 0.1, 0.18);
            playTone(440, 'square', 0.15, 0.1, 0.36);
            playTone(380, 'square', 0.15, 0.1, 0.54);
        },

        // ─── NOTIFICATION: Gentle bell ding ───
        notification() {
            if (isMuted) return;
            playTone(880, 'sine', 0.3, 0.1);
            playTone(1320, 'sine', 0.2, 0.05, 0.05);
            // Soft harmonic
            playTone(1760, 'sine', 0.15, 0.02, 0.08);
        },

        // ─── CALL RING: Looping ringtone ───
        callRing() {
            if (isMuted) return;
            this.callRingStop(); // Clear any existing ring
            const ringOnce = () => {
                playTone(440, 'sine', 0.25, 0.12, 0);
                playTone(520, 'sine', 0.25, 0.12, 0.3);
                playTone(440, 'sine', 0.25, 0.12, 0.6);
                playTone(520, 'sine', 0.25, 0.12, 0.9);
            };
            ringOnce();
            ringInterval = setInterval(ringOnce, 2000);
        },

        callRingStop() {
            if (ringInterval) {
                clearInterval(ringInterval);
                ringInterval = null;
            }
        },

        // ─── CALL ACCEPT: Bright uplifting confirmation ───
        callAccept() {
            if (isMuted) return;
            this.callRingStop();
            playTone(523, 'sine', 0.15, 0.12, 0);
            playTone(659, 'sine', 0.15, 0.1, 0.08);
            playTone(784, 'sine', 0.15, 0.1, 0.16);
            playTone(1047, 'sine', 0.3, 0.08, 0.24);  // High C — triumphant
        },

        // ─── CALL DECLINE: Soft low closing ───
        callDecline() {
            if (isMuted) return;
            this.callRingStop();
            playTone(400, 'sine', 0.2, 0.1, 0);
            playTone(300, 'sine', 0.3, 0.08, 0.1);
            playTone(200, 'sine', 0.4, 0.05, 0.2);
        },

        // ─── MODAL OPEN: Soft whoosh ───
        modalOpen() {
            if (isMuted) return;
            noiseShot(0.2, 0.04, 2000, 'highpass');
            playTone(600, 'sine', 0.15, 0.04, 0.05);
        },

        // ─── MODAL CLOSE: Reverse whoosh ───
        modalClose() {
            if (isMuted) return;
            noiseShot(0.15, 0.03, 1000, 'lowpass');
            playTone(400, 'sine', 0.1, 0.03);
        },

        // ─── AMBIENT BACKGROUND: Removed per user request ───
        ambient: {
            start() {
                return; // Disabled
            },

            stop() {
                return; // Disabled
            }
        },

        // ─── MUTE CONTROL ───
        get muted() { return isMuted; },

        toggle() {
            isMuted = !isMuted;
            localStorage.setItem('sfx_muted', isMuted);
            if (masterGain) {
                masterGain.gain.linearRampToValueAtTime(isMuted ? 0 : 1, (ctx?.currentTime || 0) + 0.1);
            }
            if (isMuted) {
                this.ambient.stop();
                this.callRingStop();
            } else {
                this.ambient.start();
            }
            return isMuted;
        },

        // Initialize (call on first user gesture)
        init() {
            getCtx();
            if (!isMuted) {
                this.ambient.start();
            }
        }
    };
})();
