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

/* ── Tiny WebAudio toolkit shared by every cue ──────────────────────────────
   makeCtx() creates + resumes a context (browsers start them SUSPENDED, which
   was making cues silent). tone()/noise() are one-shot voices with an
   attack/decay envelope and a lowpass for warmth. */
function makeCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ac = new Ctx();
  ac.resume?.();
  return ac;
}

function tone(ac, master, { freq, t, dur, type = 'sine', peak = 0.18, lp = 3200, detune = 0, slideTo }) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lp;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  if (detune) o.detune.setValueAtTime(detune, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(ac, master, { t, dur, peak = 0.18, lp = 5000, hp = 300 }) {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain();
  const hpf = ac.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
  const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

function masterGain(ac, dur) {
  const m = ac.createGain();
  m.gain.value = 1;
  m.connect(ac.destination);
  setTimeout(() => { try { ac.close(); } catch { /* noop */ } }, (dur + 0.5) * 1000);
  return m;
}

/* ── Per-category rank-UP cues (v7 §6) — each tier its OWN distinct voice ──── */
const C = { C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.51, G6: 1568.0 };

const UP_CUES = {
  // Warm temple bell — gentle, resonant (fixes Moon's dull single "tu").
  moon(ac, m) {
    [C.A4, C.C5, C.E5].forEach((f, i) => {
      tone(ac, m, { freq: f, t: i * 0.16, dur: 1.6, type: 'sine', peak: 0.24, lp: 2600 });
      tone(ac, m, { freq: f * 2, t: i * 0.16, dur: 1.0, type: 'sine', peak: 0.08, lp: 3200 });
    });
    tone(ac, m, { freq: 110, t: 0, dur: 1.4, type: 'sine', peak: 0.18 });   // soft body
  },
  // A world forms — round, full major chord with a warm sub thump.
  planet(ac, m) {
    [C.C4, C.E4, C.G4, C.C5].forEach((f, i) => tone(ac, m, { freq: f, t: i * 0.1, dur: 1.6, type: 'triangle', peak: 0.2, lp: 2600 }));
    tone(ac, m, { freq: 65, t: 0.05, dur: 0.9, type: 'sine', peak: 0.28, slideTo: 45 });
  },
  // Ignition — bright sparkling rising arpeggio + a high shimmer sweep.
  star(ac, m) {
    [C.C5, C.E5, C.G5, C.C6, C.E6].forEach((f, i) => tone(ac, m, { freq: f, t: i * 0.085, dur: 1.1, type: i % 2 ? 'triangle' : 'sine', peak: 0.2, lp: 5200 }));
    tone(ac, m, { freq: 1200, t: 0.4, dur: 1.4, type: 'sine', peak: 0.08, lp: 6000, slideTo: 2600 });
  },
  // Lighthouse — rhythmic pulsing beeps through a resonant sweep (electronic).
  pulsar(ac, m) {
    const seq = [C.G4, C.C5, C.G5, C.C6];
    seq.forEach((f, i) => tone(ac, m, { freq: f, t: i * 0.16, dur: 0.16, type: 'square', peak: 0.14, lp: 3000 }));
    tone(ac, m, { freq: C.C5, t: 0.7, dur: 1.0, type: 'sawtooth', peak: 0.14, lp: 1200, slideTo: C.C6 });
  },
  // Cataclysm — sub boom + noise blast, then a bright rising spray.
  supernova(ac, m) {
    tone(ac, m, { freq: 90, t: 0, dur: 1.2, type: 'sine', peak: 0.34, slideTo: 38 });
    noise(ac, m, { t: 0, dur: 0.5, peak: 0.22, lp: 5200, hp: 250 });
    [C.E5, C.A5, C.C6, C.E6, C.G6].forEach((f, i) => tone(ac, m, { freq: f, t: 0.25 + i * 0.07, dur: 1.0, type: 'triangle', peak: 0.18, lp: 6000 }));
  },
  // A universe — lush, wide, detuned chord pad with a slow shimmer bloom.
  galaxy(ac, m) {
    [C.C4, C.G4, C.C5, C.E5].forEach((f, i) => {
      tone(ac, m, { freq: f, t: i * 0.06, dur: 2.0, type: 'sawtooth', peak: 0.12, lp: 2200, detune: -6 });
      tone(ac, m, { freq: f, t: i * 0.06, dur: 2.0, type: 'sawtooth', peak: 0.12, lp: 2200, detune: 7 });
    });
    tone(ac, m, { freq: 1400, t: 0.6, dur: 1.6, type: 'sine', peak: 0.09, lp: 6000, slideTo: 2800 });
  },
  // Descent tiers climbing back up — a gentle, hopeful "spark catches".
  _spark(ac, m) {
    [C.G4, C.C5, C.E5].forEach((f, i) => tone(ac, m, { freq: f, t: i * 0.1, dur: 0.9, type: 'sine', peak: 0.2, lp: 3200 }));
  },
};

function playCategoryUpCue(category) {
  if (!soundManager.isEnabled()) return;
  try {
    const ac = makeCtx();
    if (!ac) return;
    const builder = UP_CUES[category] || (['asteroid', 'meteor', 'stardust'].includes(category) ? UP_CUES._spark : null);
    const dur = 2.6;
    const m = masterGain(ac, dur);
    if (builder) builder(ac, m);
    else { // generic fallback rise
      [C.G4, C.C5, C.E5, C.G5].forEach((f, i) => tone(ac, m, { freq: f, t: i * 0.09, dur: 1.0, type: 'triangle', peak: 0.18 }));
    }
  } catch { /* audio is best-effort */ }
}

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
    ac.resume?.();   // browsers create the context SUSPENDED — resume so the cue actually plays
    const now = ac.currentTime;

    const master = ac.createGain();
    master.gain.value = 0.0001;
    master.connect(ac.destination);

    const dur = 1.15;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.26, now + 0.12);   // audible, still gentler than rank-up
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Descending minor-ish arpeggio — feels like a soft cooling, not a fall.
    const notes = [587.33, 466.16, 349.23, 277.18];              // D5 → A#4 → F4 → C#4
    notes.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2000;                                  // soft, rounded but present
      o.type = 'triangle';
      const t = now + i * 0.13;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.65);
    });

    // Gentle descending sub-bass glide for warmth (no hard impact).
    const sub = ac.createOscillator();
    const sg = ac.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130, now + 0.1);
    sub.frequency.exponentialRampToValueAtTime(60, now + 0.9);
    sg.gain.setValueAtTime(0.0001, now + 0.1);
    sg.gain.exponentialRampToValueAtTime(0.22, now + 0.2);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    sub.connect(sg); sg.connect(master);
    sub.start(now + 0.1); sub.stop(now + 1.1);

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
    ac.resume?.();   // browsers create the context SUSPENDED — resume so the cue actually plays
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
  // Rank-UP: each tier category has its OWN bespoke voice (v7 §6).
  if (opts.category) return playCategoryUpCue(opts.category);

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    ac.resume?.();   // browsers create the context SUSPENDED — resume so the cue actually plays
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
