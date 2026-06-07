import { useEffect, useRef, memo, useState } from 'react';
import useAppearanceStore from '../../store/appearanceStore';
import { useThemeStore } from '../../store/themeStore';

/* ─────────────────────────────────────────────────────
   Constellation: Dynamic animated graph with nodes
───────────────────────────────────────────────────── */
const ConstellationCanvas = memo(({ colors, speedMultiplier }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (speedMultiplier === 0) return; // Don't render if animations are off

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    const hexToRgba = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},`;
    };

    const COLORS = colors.map(hexToRgba);
    const NODE_COUNT = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 25000));
    const CONNECT_DIST = 150;
    const MOUSE_DIST = 170;

    const nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4 * speedMultiplier,
      vy: (Math.random() - 0.5) * 0.4 * speedMultiplier,
      r: Math.random() * 2 + 1,
      color: COLORS[i % COLORS.length],
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: (Math.random() * 0.02 + 0.01) * speedMultiplier,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      nodes.forEach((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < MOUSE_DIST) {
          const force = (MOUSE_DIST - dist) / MOUSE_DIST;
          n.vx += (dx / dist) * force * 0.03 * speedMultiplier;
          n.vy += (dy / dist) * force * 0.03 * speedMultiplier;
        }

        n.vx *= 0.995;
        n.vy *= 0.995;
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < -20) n.x = canvas.width + 20;
        if (n.x > canvas.width + 20) n.x = -20;
        if (n.y < -20) n.y = canvas.height + 20;
        if (n.y > canvas.height + 20) n.y = -20;

        n.pulsePhase += n.pulseSpeed;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.5; // Increased from 0.3 to 0.5
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, `${a.color}${alpha})`);
            grad.addColorStop(1, `${b.color}${alpha})`);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = alpha * 3; // Increased from 2 to 3
            ctx.stroke();
          }
        }
      }

      nodes.forEach((n) => {
        const pulse = 0.6 + 0.4 * Math.sin(n.pulsePhase);
        const radius = n.r * pulse;
        const alpha = 0.5 + 0.5 * pulse;

        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 3);
        grd.addColorStop(0, `${n.color}${alpha * 0.4})`);
        grd.addColorStop(1, `${n.color}0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${n.color}${alpha})`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [colors, speedMultiplier]);

  if (speedMultiplier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

ConstellationCanvas.displayName = 'ConstellationCanvas';

/* ─────────────────────────────────────────────────────
   Mesh: Animated blob mesh
───────────────────────────────────────────────────── */
const MeshBackground = memo(({ colors, speedMultiplier }) => {
  if (speedMultiplier === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {colors.map((color, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-[120px] opacity-20"
          style={{
            width: '40vw',
            height: '40vw',
            background: color,
            top: `${20 + i * 30}%`,
            left: `${10 + i * 35}%`,
            animation: `float ${20 / speedMultiplier}s ease-in-out infinite`,
            animationDelay: `${i * 2}s`,
          }}
        />
      ))}
    </div>
  );
});

MeshBackground.displayName = 'MeshBackground';

/* ─────────────────────────────────────────────────────
   Particles: Floating dots
───────────────────────────────────────────────────── */
const ParticlesCanvas = memo(({ colors, speedMultiplier }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (speedMultiplier === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const hexToRgba = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},`;
    };

    const COLORS = colors.map(hexToRgba);
    const PARTICLE_COUNT = 60;

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5 * speedMultiplier,
      vy: (Math.random() - 0.5) * 0.5 * speedMultiplier,
      r: Math.random() * 2 + 0.5,
      color: COLORS[i % COLORS.length],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}0.6)`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [colors, speedMultiplier]);

  if (speedMultiplier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

ParticlesCanvas.displayName = 'ParticlesCanvas';

/* ─────────────────────────────────────────────────────
   Matrix: Digital rain cascade effect
───────────────────────────────────────────────────── */
const MatrixCanvas = memo(({ colors, speedMultiplier }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (speedMultiplier === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const color = hexToRgb(colors[0]);
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';

    const draw = () => {
      ctx.fillStyle = 'rgba(6, 8, 16, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        const alpha = Math.random() * 0.5 + 0.3;
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.fillText(text, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += speedMultiplier;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [colors, speedMultiplier]);

  if (speedMultiplier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

MatrixCanvas.displayName = 'MatrixCanvas';

/* ─────────────────────────────────────────────────────
   Waves: Smooth flowing wave patterns
───────────────────────────────────────────────────── */
const WavesCanvas = memo(({ colors, speedMultiplier }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (speedMultiplier === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const hexToRgba = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},`;
    };

    const COLORS = colors.map(hexToRgba);
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);

        for (let x = 0; x < canvas.width; x += 5) {
          const y =
            canvas.height / 2 +
            Math.sin((x * 0.01 + time * speedMultiplier * 0.5 + i * 2)) * 80 +
            Math.sin((x * 0.005 + time * speedMultiplier * 0.3)) * 40;

          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();

        const alpha = 0.08 - i * 0.02;
        ctx.fillStyle = `${COLORS[i]}${alpha})`;
        ctx.fill();
      }

      time += 0.01;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [colors, speedMultiplier]);

  if (speedMultiplier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

WavesCanvas.displayName = 'WavesCanvas';

/* ─────────────────────────────────────────────────────
   Neural: Pulsing neural network
───────────────────────────────────────────────────── */
const NeuralCanvas = memo(({ colors, speedMultiplier }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (speedMultiplier === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const hexToRgba = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},`;
    };

    const COLORS = colors.map(hexToRgba);
    const NODE_COUNT = 25;

    const nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: (Math.random() * 0.02 + 0.01) * speedMultiplier,
      color: COLORS[i % COLORS.length],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections with pulse
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 300) {
            const pulse = (Math.sin(a.pulsePhase) + Math.sin(b.pulsePhase)) / 2;
            const alpha = ((1 - dist / 300) * (pulse * 0.3 + 0.2));

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `${a.color}${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw pulsing nodes
      nodes.forEach((n) => {
        n.pulsePhase += n.pulseSpeed;
        const pulse = Math.sin(n.pulsePhase) * 0.5 + 0.5;
        const radius = 3 + pulse * 2;
        const alpha = 0.4 + pulse * 0.4;

        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${n.color}${alpha})`;
        ctx.fill();

        // Glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 4);
        grd.addColorStop(0, `${n.color}${alpha * 0.3})`);
        grd.addColorStop(1, `${n.color}0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [colors, speedMultiplier]);

  if (speedMultiplier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

NeuralCanvas.displayName = 'NeuralCanvas';

/* ─────────────────────────────────────────────────────
   LIGHT MODE ANIMATIONS: Airy Aurora Blobs
   Soft floating gradient orbs with gentle drift & morph
───────────────────────────────────────────────────── */
const LightAuroraCanvas = memo(({ colors, speedMultiplier, themeName }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    if (speedMultiplier === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    const hexToRgba = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const COLORS = colors.map(hexToRgba);
    
    // Theme-specific motifs
    const getOrbConfig = () => {
      switch(themeName) {
        case 'spring-garden':
          return { count: 6, size: 280, opacity: 0.18, blur: 140, speed: 0.3 }; // Blooming petals
        case 'golden-hour':
          return { count: 5, size: 320, opacity: 0.22, blur: 160, speed: 0.25 }; // Warm sunlight
        case 'lavender-dream':
          return { count: 7, size: 260, opacity: 0.16, blur: 130, speed: 0.28 }; // Soft wisps
        case 'ocean-breeze':
          return { count: 6, size: 300, opacity: 0.2, blur: 150, speed: 0.32 }; // Flowing waves
        default: // morning-sky
          return { count: 5, size: 300, opacity: 0.2, blur: 150, speed: 0.3 }; // Airy clouds
      }
    };

    const config = getOrbConfig();
    const orbs = Array.from({ length: config.count }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * config.speed * speedMultiplier,
      vy: (Math.random() - 0.5) * config.speed * speedMultiplier,
      size: config.size + Math.random() * 60,
      color: COLORS[i % COLORS.length],
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: (Math.random() * 0.008 + 0.004) * speedMultiplier,
      morphPhase: Math.random() * Math.PI * 2,
      morphSpeed: (Math.random() * 0.006 + 0.003) * speedMultiplier,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      orbs.forEach((orb, i) => {
        // Gentle mouse parallax
        const dx = orb.x - mx;
        const dy = orb.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const parallaxFactor = 0.015 * speedMultiplier;
        
        if (dist < 400) {
          const force = (400 - dist) / 400;
          orb.vx += (dx / dist) * force * parallaxFactor;
          orb.vy += (dy / dist) * force * parallaxFactor;
        }

        // Gentle friction
        orb.vx *= 0.998;
        orb.vy *= 0.998;
        
        // Move
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Wrap edges
        if (orb.x < -orb.size) orb.x = canvas.width + orb.size;
        if (orb.x > canvas.width + orb.size) orb.x = -orb.size;
        if (orb.y < -orb.size) orb.y = canvas.height + orb.size;
        if (orb.y > canvas.height + orb.size) orb.y = -orb.size;

        // Pulse & morph
        orb.pulsePhase += orb.pulseSpeed;
        orb.morphPhase += orb.morphSpeed;
        
        const pulse = 0.85 + 0.15 * Math.sin(orb.pulsePhase);
        const morph = 0.9 + 0.1 * Math.sin(orb.morphPhase);
        const currentSize = orb.size * pulse * morph;
        const currentOpacity = config.opacity * pulse;

        // Draw soft gradient orb
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, currentSize
        );
        gradient.addColorStop(0, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${currentOpacity})`);
        gradient.addColorStop(0.5, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${currentOpacity * 0.5})`);
        gradient.addColorStop(1, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [colors, speedMultiplier, themeName]);

  if (speedMultiplier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, filter: 'blur(60px)' }}
    />
  );
});

LightAuroraCanvas.displayName = 'LightAuroraCanvas';

/* ─────────────────────────────────────────────────────
   BackgroundEffects: Dynamic background system
───────────────────────────────────────────────────── */
const BackgroundEffects = memo(() => {
  const { backgroundStyle, getColors, getSpeedMultiplier, theme } = useAppearanceStore();
  const { isDark } = useThemeStore();
  const colors = getColors();
  const speedMultiplier = getSpeedMultiplier();

  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setIsTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const effectiveSpeed = (prefersReducedMotion || !isTabVisible) ? 0 : speedMultiplier;

  // Dark mode: deep space gradient. Light mode: airy pastel gradient using theme's bg color.
  const darkGradientBg = `
    radial-gradient(ellipse 100% 70% at 50% 0%, ${colors[0]}14 0%, transparent 50%),
    radial-gradient(ellipse 80% 60% at 20% 100%, ${colors[1]}10 0%, transparent 50%),
    radial-gradient(ellipse 80% 60% at 80% 100%, ${colors[2]}10 0%, transparent 50%),
    var(--bg-app)
  `;

  const lightGradientBg = `
    radial-gradient(ellipse 120% 60% at 50% -10%, ${colors[0]}28 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 10% 80%, ${colors[1]}20 0%, transparent 50%),
    radial-gradient(ellipse 70% 50% at 90% 70%, ${colors[2]}20 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(255,255,255,0.5) 0%, transparent 80%),
    var(--bg-app)
  `;

  const minimalBg = 'var(--bg-app)';

  return (
    <>
      {/* Base gradient or solid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -1,
          background: backgroundStyle === 'minimal' ? minimalBg : (isDark ? darkGradientBg : lightGradientBg),
        }}
      />

      {/* Noise texture overlay for depth - only in light mode */}
      {!isDark && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '256px 256px',
            opacity: 0.6,
          }}
        />
      )}
      
      {/* Dynamic layer based on style - ONLY IN DARK MODE */}
      {isDark && (
        <>
          {backgroundStyle === 'constellation' && (
            <ConstellationCanvas colors={colors} speedMultiplier={effectiveSpeed} isDark={isDark} />
          )}
          {backgroundStyle === 'mesh' && (
            <MeshBackground colors={colors} speedMultiplier={effectiveSpeed} isDark={isDark} />
          )}
          {backgroundStyle === 'particles' && (
            <ParticlesCanvas colors={colors} speedMultiplier={effectiveSpeed} isDark={isDark} />
          )}
          {backgroundStyle === 'matrix' && (
            <MatrixCanvas colors={colors} speedMultiplier={effectiveSpeed} />
          )}
          {backgroundStyle === 'waves' && (
            <WavesCanvas colors={colors} speedMultiplier={effectiveSpeed} isDark={isDark} />
          )}
          {backgroundStyle === 'neural' && (
            <NeuralCanvas colors={colors} speedMultiplier={effectiveSpeed} isDark={isDark} />
          )}
        </>
      )}

      {/* LIGHT MODE: Aurora orbs animation */}
      {!isDark && backgroundStyle !== 'minimal' && backgroundStyle !== 'gradient' && (
        <LightAuroraCanvas colors={colors} speedMultiplier={effectiveSpeed} themeName={theme} />
      )}
    </>
  );
});

BackgroundEffects.displayName = 'BackgroundEffects';
export default BackgroundEffects;
