const API = "/api";

// ─── CONSTELLATION + DYNAMIC CURSOR GLOW ENGINE ───
(function() {
  const canvas = document.getElementById('constellationCanvas');
  const ctx = canvas.getContext('2d');
  const pillsContainer = document.getElementById('floatingPills');
  
  const spotlight = document.createElement('div');
  spotlight.className = 'cursor-spotlight';
  document.body.appendChild(spotlight);

  // All skill labels for the floating network
  const skillLabels = [
    'Python', 'Guitar', 'Design', 'Photography', 'Yoga', 'Spanish',
    'Piano', 'Data Science', 'React', 'Machine Learning', 'Cooking',
    'Drawing', 'Singing', 'Blockchain', 'Figma', 'Dance', 'Writing',
    'Meditation', 'Video Editing', 'Illustration', 'Music Production',
    'Marketing', 'Public Speaking', 'UI/UX', 'Chess', 'Mathematics',
    'Film Making', 'Cybersecurity', 'Animation', 'Calligraphy'
  ];

  const CONNECTION_DISTANCE = 220; // max px between pills to draw a line
  const CURSOR_HIGHLIGHT_DIST = 300;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let currentHue = 200;
  let nodes = []; // { el, x, y, vx, vy, w, h }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Spawn all pills dynamically with random positions and velocities
  skillLabels.forEach((label, i) => {
    const el = document.createElement('div');
    el.className = 'floating-pill';
    el.textContent = label;
    pillsContainer.appendChild(el);

    // Random starting position across the full viewport
    const x = Math.random() * (window.innerWidth - 140);
    const y = Math.random() * (window.innerHeight - 40);

    // Random slow velocity
    const speed = 0.25 + Math.random() * 0.35;
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    nodes.push({ el, x, y, vx, vy, w: 0, h: 0 });
  });

  // Measure pill dimensions after render
  requestAnimationFrame(() => {
    nodes.forEach(n => {
      const rect = n.el.getBoundingClientRect();
      n.w = rect.width;
      n.h = rect.height;
    });
  });

  // ─── CURSOR TRACKING ───
  let rafId = null;
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const xRatio = e.clientX / window.innerWidth;
      const primaryHue = Math.round(180 + xRatio * 180) % 360;
      currentHue = primaryHue;

      spotlight.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      spotlight.style.setProperty('--glow-hue', primaryHue);
      
      rafId = null;
    });
  });

  // ─── ANIMATION LOOP ───
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Move nodes
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;

      let hitEdge = '';

      // Bounce off edges with squish detection
      if (n.x < -20) { n.x = -20; n.vx *= -1; hitEdge = 'left'; }
      if (n.x > W - n.w + 20) { n.x = W - n.w + 20; n.vx *= -1; hitEdge = 'right'; }
      if (n.y < -10) { n.y = -10; n.vy *= -1; hitEdge = 'top'; }
      if (n.y > H - n.h + 10) { n.y = H - n.h + 10; n.vy *= -1; hitEdge = 'bottom'; }

      // Apply rubber squish on boundary hit
      if (hitEdge && !n.bouncing) {
        n.bouncing = true;
        const isHorizontal = (hitEdge === 'left' || hitEdge === 'right');
        // Squish: compress along impact axis, stretch on the other
        n.el.style.transform = isHorizontal
          ? 'scaleX(0.7) scaleY(1.2)'
          : 'scaleX(1.2) scaleY(0.7)';
        // Spring back after 150ms
        setTimeout(() => {
          n.el.style.transform = 'scaleX(1) scaleY(1)';
          n.bouncing = false;
        }, 150);
      }

      n.el.style.left = n.x + 'px';
      n.el.style.top = n.y + 'px';
    });

    // Highlight pills near cursor
    nodes.forEach(n => {
      const cx = n.x + n.w / 2;
      const cy = n.y + n.h / 2;
      const dist = Math.hypot(cx - mouseX, cy - mouseY);
      if (dist < CURSOR_HIGHLIGHT_DIST) {
        n.el.classList.add('near-cursor');
      } else {
        n.el.classList.remove('near-cursor');
      }
    });

    // Draw constellation lines between nearby pills
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const bx = b.x + b.w / 2;
        const by = b.y + b.h / 2;
        const dist = Math.hypot(ax - bx, ay - by);

        if (dist < CONNECTION_DISTANCE) {
          const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.35;

          // Lines near cursor glow brighter and pick up the cursor hue
          const midX = (ax + bx) / 2;
          const midY = (ay + by) / 2;
          const cursorDist = Math.hypot(midX - mouseX, midY - mouseY);

          if (cursorDist < CURSOR_HIGHLIGHT_DIST) {
            const boost = (1 - cursorDist / CURSOR_HIGHLIGHT_DIST) * 0.6;
            ctx.strokeStyle = `hsla(${currentHue}, 100%, 65%, ${opacity + boost})`;
            ctx.lineWidth = 1.2;
          } else {
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
            ctx.lineWidth = 0.6;
          }

          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }

    // Draw cursor-to-nearby-pill lines (interactive web effect)
    nodes.forEach(n => {
      const cx = n.x + n.w / 2;
      const cy = n.y + n.h / 2;
      const dist = Math.hypot(cx - mouseX, cy - mouseY);

      if (dist < CURSOR_HIGHLIGHT_DIST) {
        const opacity = (1 - dist / CURSOR_HIGHLIGHT_DIST) * 0.5;
        ctx.strokeStyle = `hsla(${currentHue}, 100%, 70%, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    });

    requestAnimationFrame(animate);
  }

  animate();
})();


// ─── AUTH LOGIC ───
function switchTab(tab) {
  if (typeof SFX !== 'undefined') SFX.tabSwitch();
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById(tab === 'login' ? 'tabLogin' : 'tabRegister').classList.add('active');
  document.getElementById(tab === 'login' ? 'loginSection' : 'registerSection').classList.add('active');
  hideAlert();
}

function showAlert(msg, type = 'error') {
  if (typeof SFX !== 'undefined' && type === 'error') SFX.error();
  const box = document.getElementById('alertBox');
  box.textContent = msg;
  box.className = `alert ${type}`;
}

function hideAlert() {
  document.getElementById('alertBox').className = 'alert hidden';
}

function setLoading(btn, loading) {
  if (loading) { btn.classList.add('loading'); btn.disabled = true; }
  else { btn.classList.remove('loading'); btn.disabled = false; }
}

async function handleLogin() {
  if (typeof SFX !== 'undefined') SFX.click();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');

  if (!email || !password) return showAlert("Please fill in all fields");

  setLoading(btn, true);

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (!res.ok) {
      if (res.status === 403 && data.banned) {
        showBanWarning(data.timeRemaining);
        return;
      }
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem('token', data.token);
    showAlert("Welcome back! Redirecting…", "success");
    if (typeof SFX !== 'undefined') SFX.success();
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);

  } catch (err) {
    showAlert(err.message);
  } finally {
    setLoading(btn, false);
  }
}

function showBanWarning(hours) {
  let overlay = document.getElementById('banWarningOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'banWarningOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(10px);';
    overlay.innerHTML = `
      <div style="background:#2a0a10; border:2px solid #ff4b4b; border-radius:16px; padding:40px; max-width:500px; text-align:center; box-shadow:0 10px 40px rgba(255,75,75,0.3);">
        <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
        <h2 style="color:#ff4b4b; font-size:24px; font-weight:800; margin-bottom:12px; text-transform:uppercase;">Account Banned</h2>
        <p style="color:#ffb3b3; font-size:16px; margin-bottom:24px; line-height:1.5;">
          For severe safety policy violations, your account has been temporarily banned.
        </p>
        <div style="font-family:monospace; font-size:24px; color:#ff4b4b; font-weight:700;">Time remaining: <span id="banWarningHours">${hours}</span> hours</div>
        <button onclick="document.getElementById('banWarningOverlay').style.display='none'" style="margin-top:24px; background:#ff4b4b; color:#fff; border:none; padding:10px 24px; border-radius:8px; font-weight:bold; cursor:pointer;">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    document.getElementById('banWarningHours').textContent = hours;
    overlay.style.display = 'flex';
  }
}

async function handleRegister() {
  if (typeof SFX !== 'undefined') SFX.click();
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const btn      = document.getElementById('regBtn');
  
  const selectedPills = document.querySelectorAll('.lang-pill.active');
  const languages = Array.from(selectedPills).map(pill => pill.dataset.lang);

  if (!name || !email || !password) return showAlert("Please fill in all fields");
  if (password.length < 6) return showAlert("Password must be at least 6 characters");

  setLoading(btn, true);

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, languages })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Registration failed");

    showAlert("Account created! Signing you in…", "success");
    if (typeof SFX !== 'undefined') SFX.success();
    setTimeout(() => switchTab('login'), 1200);

  } catch (err) {
    showAlert(err.message);
  } finally {
    setLoading(btn, false);
  }
}

// Redirect if already authenticated
if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}

// Enter key submit
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const loginActive = document.getElementById('loginSection').classList.contains('active');
    if (loginActive) handleLogin(); else handleRegister();
  }
});

// Language pill click handlers (multi-select)
document.querySelectorAll('#regLanguages .lang-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const isActive = pill.classList.toggle('active');
    if (typeof SFX !== 'undefined') {
        isActive ? SFX.toggleOn() : SFX.toggleOff();
    }
  });
});

// Global click listener to initialize audio context
document.addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.init();
}, { once: true });

// ─── REAL OAUTH LOGIC ───
function mockOAuthLogin(provider, event) {
  if (typeof SFX !== 'undefined') SFX.click();
  const btn = event.currentTarget;
  const originalHTML = btn.innerHTML;
  
  btn.innerHTML = '<div class="spinner" style="display:block; width:22px; height:22px; border-width:3px; margin:0; opacity:1;"></div>';
  btn.style.pointerEvents = 'none';

  // Redirect to backend OAuth endpoints
  const route = provider.toLowerCase();
  window.location.href = `http://localhost:8000/api/auth/${route}`;
}
