/**
 * orbitRevealSound — a space-oriented transition sound for OrbitTeaserReveal,
 * synthesised with the Web Audio API and scheduled to the reveal timeline.
 * No audio files (the repo ships only ambient music); this is fully generative
 * so it stays in sync with the animation and adds no asset weight.
 *
 * Timeline (t = seconds from reveal start):
 *   0.0s  deep sub-bass space drone swells in (slow vibrato)
 *   1.6s  airy shimmering riser as the ashes begin to stream
 *   2.0s  continuous filtered-noise "stardust stream", slowly panning + sweeping
 *   2.7s+ soft glitter chimes as the buckets fill
 *   6.1s  warm resolving chord + gentle down-whoosh as it settles
 *
 * Browsers block audio until a user gesture, so the first play may be silent;
 * call again from a click (Replay / Sound toggle) to hear it in sync.
 */
let _ctx = null;

export function playSpaceReveal() {
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return;
  const ctx = _ctx || (_ctx = new Ctx());
  if (ctx.state === 'suspended') ctx.resume();

  const t0 = ctx.currentTime + 0.03;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  const noise = (sec) => {
    const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * sec)), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  const gainAt = (g, v, t) => g.gain.setValueAtTime(v, t);
  const ramp = (g, v, t) => g.gain.linearRampToValueAtTime(v, t);

  // 1) sub-bass space drone (with a slow vibrato)
  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 48;
  const droneG = ctx.createGain();
  gainAt(droneG, 0.0001, t0);
  droneG.gain.exponentialRampToValueAtTime(0.22, t0 + 1.3);
  gainAt(droneG, 0.22, t0 + 5.4);
  droneG.gain.exponentialRampToValueAtTime(0.0001, t0 + 8.0);
  const dLFO = ctx.createOscillator();
  dLFO.frequency.value = 0.15;
  const dLFOg = ctx.createGain();
  dLFOg.gain.value = 6;
  dLFO.connect(dLFOg).connect(drone.frequency);
  drone.connect(droneG).connect(master);
  drone.start(t0);
  drone.stop(t0 + 8.1);
  dLFO.start(t0);
  dLFO.stop(t0 + 8.1);

  // 2) rising shimmer whoosh (riser)
  const riser = ctx.createBufferSource();
  riser.buffer = noise(3.2);
  const rBP = ctx.createBiquadFilter();
  rBP.type = 'bandpass';
  rBP.Q.value = 1.1;
  rBP.frequency.setValueAtTime(320, t0 + 1.5);
  rBP.frequency.exponentialRampToValueAtTime(4600, t0 + 3.1);
  const rG = ctx.createGain();
  gainAt(rG, 0.0001, t0 + 1.5);
  ramp(rG, 0.17, t0 + 2.4);
  ramp(rG, 0.0001, t0 + 3.4);
  riser.connect(rBP).connect(rG).connect(master);
  riser.start(t0 + 1.5);
  riser.stop(t0 + 3.5);

  // 3) continuous stardust-stream bed (filtered noise), slowly panning + sweeping
  const stream = ctx.createBufferSource();
  stream.buffer = noise(5);
  stream.loop = true;
  const sBP = ctx.createBiquadFilter();
  sBP.type = 'bandpass';
  sBP.Q.value = 0.8;
  sBP.frequency.value = 1700;
  const sLFO = ctx.createOscillator();
  sLFO.frequency.value = 0.45;
  const sLFOg = ctx.createGain();
  sLFOg.gain.value = 1000;
  sLFO.connect(sLFOg).connect(sBP.frequency);
  const sG = ctx.createGain();
  gainAt(sG, 0.0001, t0 + 2.0);
  ramp(sG, 0.13, t0 + 2.9);
  gainAt(sG, 0.13, t0 + 5.0);
  ramp(sG, 0.0001, t0 + 6.3);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) {
    const pLFO = ctx.createOscillator();
    pLFO.frequency.value = 0.3;
    const pLFOg = ctx.createGain();
    pLFOg.gain.value = 0.85;
    pLFO.connect(pLFOg).connect(pan.pan);
    stream.connect(sBP).connect(pan).connect(sG);
    pLFO.start(t0);
    pLFO.stop(t0 + 7);
  } else {
    stream.connect(sBP).connect(sG);
  }
  sG.connect(master);
  sLFO.start(t0);
  sLFO.stop(t0 + 7);
  stream.start(t0 + 2.0);
  stream.stop(t0 + 6.5);

  // 4) glitter chimes as the buckets fill
  const chimeT = [2.7, 3.2, 3.8, 4.3, 4.9, 5.4, 5.9];
  const notes = [1568, 1760, 2093, 2349, 2637, 1976, 3136];
  chimeT.forEach((tt, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = notes[i % notes.length];
    const g = ctx.createGain();
    gainAt(g, 0.0001, t0 + tt);
    g.gain.exponentialRampToValueAtTime(0.085, t0 + tt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tt + 0.5);
    o.connect(g).connect(master);
    o.start(t0 + tt);
    o.stop(t0 + tt + 0.55);
  });

  // 5) warm resolving chord + settle down-whoosh
  [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 3 ? 'triangle' : 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    gainAt(g, 0.0001, t0 + 6.1);
    ramp(g, 0.1, t0 + 6.6);
    ramp(g, 0.0001, t0 + 8.0);
    o.connect(g).connect(master);
    o.start(t0 + 6.1);
    o.stop(t0 + 8.1);
  });
  const dn = ctx.createBufferSource();
  dn.buffer = noise(2);
  const dBP = ctx.createBiquadFilter();
  dBP.type = 'bandpass';
  dBP.Q.value = 1.4;
  dBP.frequency.setValueAtTime(3200, t0 + 6.1);
  dBP.frequency.exponentialRampToValueAtTime(520, t0 + 6.9);
  const dnG = ctx.createGain();
  gainAt(dnG, 0.0001, t0 + 6.1);
  ramp(dnG, 0.12, t0 + 6.35);
  ramp(dnG, 0.0001, t0 + 7.0);
  dn.connect(dBP).connect(dnG).connect(master);
  dn.start(t0 + 6.1);
  dn.stop(t0 + 7.1);
}
