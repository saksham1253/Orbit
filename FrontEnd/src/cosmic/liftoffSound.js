/**
 * liftoffSound.js — a bespoke cinematic chime for the rank-up moment, built
 * live with the WebAudio API (no audio assets, free-tier safe). Obeys the
 * app's UI Sounds toggle via soundManager.isEnabled() (spec §8).
 *
 * `grand` = full category-promotion fanfare; otherwise a shorter within-tier
 * sparkle. Everything is wrapped in try/catch so audio can never break the UI.
 */
import soundManager from '../utils/soundManager';

export function playLiftoffChime(grand = true) {
  if (!soundManager.isEnabled()) return;     // respect the UI Sounds toggle

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
