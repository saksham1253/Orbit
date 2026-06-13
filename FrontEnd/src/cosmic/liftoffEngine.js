/**
 * liftoffEngine.js — the canvas cinematics behind a rank-up "Liftoff" (spec §8).
 *
 * A single requestAnimationFrame loop runs a phase timeline:
 *   IMPLOSION → IGNITION FLASH → SIGNATURE BURST → drift/settle.
 * Each cosmic CATEGORY gets its own signature choreography, recoloured from the
 * tier palette. Additive: this is a self-contained effect drawn on its own
 * canvas; it touches no existing engine. (The constellation/node-line aesthetic
 * is echoed in the Galaxy signature, which links nearby particles with faint
 * lines.)
 *
 * Performance: particle counts scale with viewport area and are hard-capped;
 * DPR capped at 2; everything drawn additively ('lighter') for cheap glow; the
 * loop stops itself and frees particles on stop().
 *
 * Accessibility: when reducedMotion is true the caller skips the engine
 * entirely and crossfades instead (see LiftoffOverlay). Timings scale with the
 * Animation Speed multiplier passed in as `speed`.
 */

const PALETTE = {
  moon:      ['#EDE6DA', '#C9C0B2', '#A8A096', '#8D8478'],
  planet:    ['#FFE9D6', '#E8C09B', '#D8A47F', '#9E4A33'],
  star:      ['#FFFFFF', '#E8F2FF', '#A9D6FF', '#7FB2FF'],
  pulsar:    ['#FFFFFF', '#E0FBFF', '#7FE1FF', '#4CC9F0'],
  supernova: ['#FFFFFF', '#FFE9A8', '#FFD08A', '#FF6B35', '#C81E00'],
  galaxy:    ['#FFFFFF', '#F6C667', '#FF8FCF', '#9B6BFF'],
  quasar:    ['#FFFFFF', '#CFE6FF', '#8EC5FF'],
};

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class LiftoffEngine {
  constructor(canvas, { category, promotion = true, speed = 1, onReveal, onDone }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.category = PALETTE[category] ? category : 'star';
    this.colors = PALETTE[this.category];
    this.promotion = promotion;
    this.speed = Math.max(0.4, speed || 1);
    this.onReveal = onReveal || (() => {});
    this.onDone = onDone || (() => {});

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.stars = [];
    this.rings = [];
    this._revealed = false;
    this._burst = false;
    this._raf = null;
    this._start = 0;

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
  }

  start() {
    this._resize();
    window.addEventListener('resize', this._resize);
    // ambient twinkle field
    const n = Math.min(120, Math.floor((this.W * this.H) / 14000));
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random() * this.W, y: Math.random() * this.H,
        r: Math.random() * 1.4 + 0.2, p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.04 + 0.01,
      });
    }
    this._start = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    window.removeEventListener('resize', this._resize);
    this.particles.length = 0; this.stars.length = 0; this.rings.length = 0;
  }

  _resize() {
    const { canvas } = this;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    canvas.width = this.W * this.dpr;
    canvas.height = this.H * this.dpr;
    canvas.style.width = this.W + 'px';
    canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = this.W / 2; this.cy = this.H * 0.42;
    this.maxR = Math.hypot(this.W, this.H) / 2;
  }

  _spawn(p) { if (this.particles.length < 1400) this.particles.push(p); }

  _emitBurst(count, sp0, sp1, life0, life1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = sp0 + Math.random() * (sp1 - sp0);
      this._spawn({
        x: this.cx, y: this.cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: life0 + Math.random() * (life1 - life0),
        size: Math.random() * 2.6 + 0.6, color: pick(this.colors), drag: 0.965, grav: 0,
      });
    }
  }

  _frame(now) {
    const ctx = this.ctx;
    const dt = 1 / 60;
    const t = ((now - this._start) / 1000) * this.speed; // scaled timeline seconds

    // Trail-fade backdrop (deep space) — cheaper than clearRect for glow trails.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(8,3,20,0.34)';
    ctx.fillRect(0, 0, this.W, this.H);

    // Twinkling ambient stars.
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      s.p += s.s;
      const tw = 0.4 + (Math.sin(s.p) + 1) / 2 * 0.6;
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.promotion) this._runPromotion(ctx, t, dt);
    else this._runWithinTier(ctx, t, dt);

    // Integrate + draw particles.
    this._drawParticles(ctx, dt);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    const total = this.promotion ? 3.2 : 1.7;
    if (t < total + 0.4) {
      this._raf = requestAnimationFrame(this._frame);
    } else {
      this.onDone();
    }
  }

  // ── Choreography: category promotion ──────────────────────────────────────
  _runPromotion(ctx, t, dt) {
    const T = { implode: 0.7, flash: 1.05, burst: 3.0 };

    // IMPLOSION — stardust streaks rush inward; a seed brightens at center.
    if (t < T.implode) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = this.maxR * (0.7 + Math.random() * 0.5);
        const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
        const sp = (r / T.implode) * 0.02;
        this._spawn({
          x, y, vx: -Math.cos(a) * sp * 60, vy: -Math.sin(a) * sp * 60,
          life: 0, max: 0.8, size: Math.random() * 1.8 + 0.4,
          color: pick(this.colors), drag: 1.0, grav: 0, pull: true,
        });
      }
      const seed = (t / T.implode);
      this._glow(ctx, this.cx, this.cy, 6 + seed * 26, `rgba(255,255,255,${0.2 + seed * 0.5})`);
    }

    // IGNITION FLASH — white bloom + the outward burst.
    if (t >= T.implode && !this._revealed && t >= 1.0) { this._revealed = true; this.onReveal(); }
    if (t >= T.implode && !this._burst) {
      this._burst = true;
      this.particles.length = 0; // clear inward streaks
      const n = Math.min(320, Math.floor((this.W * this.H) / 7000));
      this._emitBurst(n, 2, 11, 0.9, 2.0);
    }
    if (t >= T.implode && t < T.flash) {
      const f = 1 - (t - T.implode) / (T.flash - T.implode);
      this._glow(ctx, this.cx, this.cy, this.maxR * (0.4 + (1 - f) * 0.7), `rgba(255,255,255,${f * 0.85})`);
      // lens streak for the brightest categories
      if (this.category === 'star' || this.category === 'quasar' || this.category === 'supernova') {
        this._lensStreak(ctx, f);
      }
    }

    // SIGNATURE BURST — category-specific.
    if (t >= T.flash) this._signature(ctx, t - T.flash, dt);
  }

  _runWithinTier(ctx, t, dt) {
    // Quick charge → ring pop + sparkle; badge just intensifies (revealed early).
    if (!this._revealed && t >= 0.1) { this._revealed = true; this.onReveal(); }
    if (t < 0.45) {
      const s = t / 0.45;
      this._glow(ctx, this.cx, this.cy, 10 + s * 40, `rgba(255,255,255,${0.15 + s * 0.4})`);
    }
    if (t >= 0.45 && !this._burst) {
      this._burst = true;
      this.rings.push({ r: 10, t: 0, color: this.colors[1], max: 0.8 });
      this._emitBurst(Math.min(120, Math.floor((this.W * this.H) / 16000)), 1.5, 6, 0.6, 1.2);
    }
    this._drawRings(ctx, dt);
  }

  // ── Category signatures ───────────────────────────────────────────────────
  _signature(ctx, st, dt) {
    switch (this.category) {
      case 'planet':    return this._sigPlanet(ctx, st);
      case 'star':      return this._sigStar(ctx, st);
      case 'pulsar':    return this._sigPulsar(ctx, st);
      case 'supernova': return this._sigSupernova(ctx, st, dt);
      case 'galaxy':    return this._sigGalaxy(ctx, st);
      case 'quasar':    return this._sigQuasar(ctx, st);
      default:          return this._sigStar(ctx, st);
    }
  }

  _sigPlanet(ctx, st) {
    // Atmosphere rings bloom outward; a dust halo orbits.
    if (st < 0.05) { this.rings.push({ r: 30, t: 0, color: this.colors[1], max: 1.4, w: 3 }); }
    this._drawRings(ctx, 1 / 60);
    const orb = 70 + Math.sin(st * 2) * 6;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + st * 0.8;
      const x = this.cx + Math.cos(a) * orb * 1.8;
      const y = this.cy + Math.sin(a) * orb * 0.7;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _sigStar(ctx, st) {
    // Pulsing corona rays + a long horizontal lens flare that settles.
    ctx.globalCompositeOperation = 'lighter';
    const rays = 16;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const len = (90 + Math.sin(st * 4 + i) * 26) * Math.max(0, 1 - st / 2);
      const grad = ctx.createLinearGradient(this.cx, this.cy, this.cx + Math.cos(a) * len, this.cy + Math.sin(a) * len);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(127,178,255,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = i % 2 ? 1.5 : 3;
      ctx.beginPath(); ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(a) * len, this.cy + Math.sin(a) * len); ctx.stroke();
    }
    this._lensStreak(ctx, Math.max(0, 1 - st / 1.6));
  }

  _sigPulsar(ctx, st) {
    // Two beams sweep the screen; shockwave rings pulse outward.
    if (st % 0.5 < 0.02) this.rings.push({ r: 20, t: 0, color: this.colors[2], max: 1.0, w: 2 });
    this._drawRings(ctx, 1 / 60);
    ctx.globalCompositeOperation = 'lighter';
    const rot = st * 3.0;
    for (let k = 0; k < 2; k++) {
      const a = rot + k * Math.PI;
      const x2 = this.cx + Math.cos(a) * this.maxR * 1.4;
      const y2 = this.cy + Math.sin(a) * this.maxR * 1.4;
      const grad = ctx.createLinearGradient(this.cx, this.cy, x2, y2);
      grad.addColorStop(0, 'rgba(224,251,255,0.85)');
      grad.addColorStop(0.3, 'rgba(127,225,255,0.35)');
      grad.addColorStop(1, 'rgba(76,201,240,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(x2, y2); ctx.stroke();
    }
    this._glow(ctx, this.cx, this.cy, 16, 'rgba(224,251,255,0.8)');
  }

  _sigSupernova(ctx, st, dt) {
    // Giant shockwave + screen shake feel via a second expanding ring.
    if (st < 0.05) {
      this.rings.push({ r: 30, t: 0, color: '#FFD08A', max: 1.6, w: 6 });
      this.rings.push({ r: 10, t: -0.1, color: '#FF6B35', max: 1.8, w: 3 });
      // secondary debris on the burst
      this._emitBurst(Math.min(180, Math.floor((this.W * this.H) / 11000)), 3, 13, 1.0, 2.2);
    }
    this._drawRings(ctx, dt);
    this._glow(ctx, this.cx, this.cy, 30 * Math.max(0, 1 - st / 1.5), 'rgba(255,200,120,0.6)');
  }

  _sigGalaxy(ctx, st) {
    // Particles spiral into arms; nearby ones link with faint lines
    // (a nod to the app's constellation/node-line engine).
    ctx.globalCompositeOperation = 'lighter';
    const arms = 3, pts = [];
    for (let i = 0; i < 160; i++) {
      const arm = i % arms;
      const rr = (i / 160) * Math.min(this.W, this.H) * 0.42;
      const a = rr * 0.045 + (arm / arms) * Math.PI * 2 + st * 0.5;
      const x = this.cx + Math.cos(a) * rr;
      const y = this.cy + Math.sin(a) * rr * 0.72;
      pts.push([x, y]);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.12; ctx.strokeStyle = '#FF8FCF'; ctx.lineWidth = 0.6;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      if (dx * dx + dy * dy < 900) {
        ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    this._glow(ctx, this.cx, this.cy, 14 + Math.sin(st * 3) * 4, 'rgba(255,255,255,0.85)');
  }

  _sigQuasar(ctx, st) {
    // Blackout, then one blinding vertical axial jet erupts with lateral flare.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(2,1,8,${Math.max(0, 0.7 - st * 0.6)})`;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter';
    const w = (8 + Math.sin(st * 8) * 3) * Math.min(1, st * 3);
    const jet = ctx.createLinearGradient(this.cx, 0, this.cx, this.H);
    jet.addColorStop(0, 'rgba(142,197,255,0)');
    jet.addColorStop(0.42, 'rgba(255,255,255,0.95)');
    jet.addColorStop(0.5, 'rgba(255,255,255,1)');
    jet.addColorStop(0.58, 'rgba(255,255,255,0.95)');
    jet.addColorStop(1, 'rgba(142,197,255,0)');
    ctx.fillStyle = jet;
    ctx.fillRect(this.cx - w, 0, w * 2, this.H);
    this._lensStreak(ctx, Math.max(0, 1 - st / 2));
    this._glow(ctx, this.cx, this.cy, 22, 'rgba(207,230,255,0.9)');
  }

  // ── primitives ────────────────────────────────────────────────────────────
  _glow(ctx, x, y, r, color) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  _lensStreak(ctx, alpha) {
    if (alpha <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    const w = this.W * 0.9;
    const g = ctx.createLinearGradient(this.cx - w / 2, this.cy, this.cx + w / 2, this.cy);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.9})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(this.cx - w / 2, this.cy - 1.5, w, 3);
  }

  _drawRings(ctx, dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.max;
      if (k >= 1) { this.rings.splice(i, 1); continue; }
      r.r += (this.maxR * 1.1) * dt / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.lineWidth = (r.w || 2) * (1 - k * 0.5);
      ctx.beginPath(); ctx.arc(this.cx, this.cy, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawParticles(ctx, dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      if (p.pull) { // inward streaks accelerate toward center
        p.vx += (this.cx - p.x) * 0.0009 * 60 * dt;
        p.vy += (this.cy - p.y) * 0.0009 * 60 * dt;
      }
      p.vx *= p.drag; p.vy *= p.drag; p.vy += (p.grav || 0);
      p.x += p.vx; p.y += p.vy;
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
