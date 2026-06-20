/**
 * liftoffSound.js — bespoke cinematic cues for the rank moments, built live with
 * the WebAudio API (no audio assets, free-tier safe). Obeys the app's UI Sounds
 * toggle via soundManager.isEnabled() (spec §8; v5 §1).
 *
 * `grand` = full category-promotion fanfare; otherwise a shorter within-tier
 * sparkle. Pass `{ down: true }` for the rank-DOWN cue — a soft, dignified,
 * *descending* cooling tone (never harsh; quieter and shorter than rank-up),
 * per v5 §1. Everything is wrapped in try/catch so audio can never break the UI.
 */
import soundManager from '../utils/soundManager';

/**
 * Rank-DOWN cooling cue (v5 §1): a gentle descending arpeggio, low and quiet,
 * ~0.9s. Encouraging, not punishing — matches the v4 "still burning" tone.
 */
export function playDescentChime() {
  if (!soundManager.isEnabled()) return;     // respect the UI Sounds toggle

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const now = ac.currentTime;

    const master = ac.createGain();
    master.gain.value = 0.0001;
    master.connect(ac.destination);

    const dur = 0.95;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.12, now + 0.12);   // quieter than rank-up
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Descending minor-ish arpeggio — feels like a soft cooling, not a fall.
    const notes = [523.25, 392.0, 311.13];                        // C5 → G4 → Eb4
    notes.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;                                  // soft, rounded
      o.type = 'sine';
      const t = now + i * 0.13;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.6);
    });

    // Gentle descending sub-bass glide for warmth (no hard impact).
    const sub = ac.createOscillator();
    const sg = ac.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now + 0.1);
    sub.frequency.exponentialRampToValueAtTime(60, now + 0.8);
    sg.gain.setValueAtTime(0.0001, now + 0.1);
    sg.gain.exponentialRampToValueAtTime(0.12, now + 0.2);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    sub.connect(sg); sg.connect(master);
    sub.start(now + 0.1); sub.stop(now + 0.95);

    setTimeout(() => { try { ac.close(); } catch { /* noop */ } }, (dur + 0.4) * 1000);
  } catch {
    /* audio is best-effort; never throw into the UI */
  }
}

/**
 * Quasar cue (v7 §6) — the grandest, rarest moment. A slow cinematic swell of
 * stacked harmonics under a long rising shimmer that climbs higher than any
 * other cue, capped by a bright bell arpeggio and a deep sub-impact. ~2.6s,
 * clearly distinct from the standard rank-up fanfare (reserved for the secret
 * Quasar tier). Best-effort; never throws into the UI.
 */
export function playQuasarChime() {
  if (!soundManager.isEnabled()) return;     // respect the UI Sounds toggle

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const now = ac.currentTime;
    const dur = 2.7;

    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.3, now + 0.4);     // slow, awe-inducing swell
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    master.connect(ac.destination);

    // Sustained harmonic bed — a chord of stacked octaves + fifth, lightly
    // detuned for shimmer/richness (distinct from the bright arpeggio of rank-up).
    const bed = [130.81, 196.0, 261.63, 392.0, 523.25];          // C3 G3 C4 G4 C5
    bed.forEach((f, i) => {
      [0, 1.5].forEach((detune) => {                              // two detuned voices
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = i < 2 ? 'sawtooth' : 'triangle';
        o.frequency.setValueAtTime(f, now);
        o.detune.setValueAtTime(detune, now);
        const t = now + i * 0.08;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, now);
        lp.frequency.exponentialRampToValueAtTime(4200, now + 1.6); // filter opens = "blooming"
        o.connect(lp); lp.connect(g); g.connect(master);
        o.start(t); o.stop(now + dur);
      });
    });

    // Long rising shimmer — climbs higher than the grand fanfare's sweep.
    const shimmer = ac.createOscillator();
    const sg = ac.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1046.5, now + 0.3);
    shimmer.frequency.exponentialRampToValueAtTime(4186, now + 2.0);  // up to C8
    sg.gain.setValueAtTime(0.0001, now + 0.3);
    sg.gain.exponentialRampToValueAtTime(0.12, now + 1.0);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    shimmer.connect(sg); sg.connect(master);
    shimmer.start(now + 0.3); shimmer.stop(now + 2.5);

    // Bright bell arpeggio at the peak — the "burst" landing.
    const bells = [1046.5, 1318.5, 1568.0, 2093.0];              // C6 E6 G6 C7
    bells.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      const t = now + 1.1 + i * 0.1;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 1.1);
    });

    // Deep sub-impact for cinematic weight.
    const sub = ac.createOscillator();
    const subg = ac.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70, now + 1.0);
    sub.frequency.exponentialRampToValueAtTime(34, now + 2.2);
    subg.gain.setValueAtTime(0.0001, now + 1.0);
    subg.gain.exponentialRampToValueAtTime(0.32, now + 1.15);
    subg.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
    sub.connect(subg); subg.connect(master);
    sub.start(now + 1.0); sub.stop(now + 2.4);

    setTimeout(() => { try { ac.close(); } catch { /* noop */ } }, (dur + 0.4) * 1000);
  } catch {
    /* audio is best-effort; never throw into the UI */
  }
}

export function playLiftoffChime(grand = true, opts = {}) {
  if (!soundManager.isEnabled()) return;     // respect the UI Sounds toggle

  // Quasar gets its own grandest, distinct cue (v7 §6).
  if (opts.quasar) return playQuasarChime();
  // Rank-DOWN delegates to the dedicated descending cooling cue.
  if (opts.down) return playDescentChime();

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const now = ac.currentTime;

    const master = ac.createGain();
    master.gain.value = 0.0001;
    master.connect(ac.destination);

    const dur = grand ? 2.8 : 1.3;
    // Slow swell up, long tail down.
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(grand ? 0.26 : 0.18, now + 0.18);
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Rising major arpeggio — feels like ascending.
    const notes = grand
      ? [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5]   // C major up two octaves
      : [392.0, 523.25, 659.25];                                   // G–C–E
    notes.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2800;
      o.type = i % 2 ? 'triangle' : 'sine';
      const t = now + i * (grand ? 0.11 : 0.075);
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(grand ? 0.2 : 0.16, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (grand ? 1.5 : 0.85));
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); o.stop(t + (grand ? 1.7 : 1.0));
    });

    // Shimmer sweep on top for the grand version.
    if (grand) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1568, now + 0.55);
      o.frequency.exponentialRampToValueAtTime(2793, now + 1.6);
      g.gain.setValueAtTime(0.0001, now + 0.55);
      g.gain.exponentialRampToValueAtTime(0.09, now + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      o.connect(g); g.connect(master);
      o.start(now + 0.55); o.stop(now + 2.4);
    }

    // Sub-bass impact at the burst for weight.
    const sub = ac.createOscillator();
    const sg = ac.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(grand ? 80 : 110, now + (grand ? 0.7 : 0.2));
    sub.frequency.exponentialRampToValueAtTime(40, now + (grand ? 1.4 : 0.7));
    sg.gain.setValueAtTime(0.0001, now + (grand ? 0.7 : 0.2));
    sg.gain.exponentialRampToValueAtTime(grand ? 0.3 : 0.18, now + (grand ? 0.8 : 0.28));
    sg.gain.exponentialRampToValueAtTime(0.0001, now + (grand ? 1.8 : 0.9));
    sub.connect(sg); sg.connect(master);
    sub.start(now + (grand ? 0.7 : 0.2)); sub.stop(now + (grand ? 1.9 : 1.0));

    setTimeout(() => { try { ac.close(); } catch { /* noop */ } }, (dur + 0.4) * 1000);
  } catch {
    /* audio is best-effort; never throw into the UI */
  }
}
