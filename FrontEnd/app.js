const API = "/api";

function toggleSound() {
    if (typeof SFX !== 'undefined') {
        const isMuted = SFX.toggle();
        document.getElementById('soundOnIcon').style.display = isMuted ? 'none' : 'block';
        document.getElementById('soundOffIcon').style.display = isMuted ? 'block' : 'none';
    }
}

// Global click listener to initialize audio context
document.addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.init();
}, { once: true });

window.addEventListener('DOMContentLoaded', () => {
    // initialize toggle icon state
    if (localStorage.getItem('sfx_muted') === 'true') {
        if(document.getElementById('soundOnIcon')) document.getElementById('soundOnIcon').style.display = 'none';
        if(document.getElementById('soundOffIcon')) document.getElementById('soundOffIcon').style.display = 'block';
    }
});

// Check for OAuth token in URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('token')) {
    localStorage.setItem('token', urlParams.get('token'));
    if (urlParams.get('isNew') === 'true') {
        localStorage.setItem('needsOnboarding', 'true');
    }
    window.history.replaceState({}, document.title, window.location.pathname);
}

const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
let map = null, markersLayer = null, userProfile = null;
let connectedUserIds = [];
let currentVideoPartnerId = null;
let currentVideoPartnerName = null;
let audioRecorder = null;
let audioStream = null;

async function fetchConnectedUsers() {
  if (!userProfile) return;
  try {
    const res = await fetch(`${API}/connections/all`, { headers: authHeaders });
    if (!res.ok) return;
    const connections = await res.json();
    connectedUserIds = connections
      .filter(c => c.status === 'accepted')
      .map(c => {
         const reqId = typeof c.requester === 'object' ? c.requester._id : c.requester;
         const recId = typeof c.receiver === 'object' ? c.receiver._id : c.receiver;
         return reqId === userProfile._id ? recId : reqId;
      });
  } catch (err) { console.error("Error fetching connections:", err); }
}

// ─── DYNAMIC CURSOR GLOW (Hardware Accelerated) ───
(function() {
  const spotlight = document.createElement('div');
  spotlight.className = 'cursor-spotlight';
  document.body.appendChild(spotlight);
  
  const bgGrid = document.querySelector('.bg-grid');
  
  let rafId = null;
  document.addEventListener('mousemove', (e) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const xRatio = e.clientX / window.innerWidth;
      const primaryHue = Math.round(180 + xRatio * 180) % 360;
      
      spotlight.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      spotlight.style.setProperty('--glow-hue', primaryHue);
      
      if (bgGrid) {
        bgGrid.style.setProperty('--mouse-x', `${e.clientX}px`);
        bgGrid.style.setProperty('--mouse-y', `${e.clientY}px`);
      }
      
      rafId = null;
    });
  });

  // Setup Pill click listeners for profile section only (multi-select)
  document.querySelectorAll('#editLanguages .lang-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
    });
  });
})();

// ─── TOAST ───
function toast(msg, type = 'success') {
  if (typeof SFX !== 'undefined') {
    if (type === 'success') SFX.notification();
    else if (type === 'error' || type === 'danger') SFX.error();
  }
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.className = 'toast', 3000);
}

// ─── NAV ───
function switchSection(name) {
  if (typeof SFX !== 'undefined') SFX.tabSwitch();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(name + 'Section').classList.add('active');
  document.getElementById('topTitle').textContent = {
    my: 'My Skills', browse: 'Browse Skills', matches: 'Matches', nearby: 'Nearby Map', video: 'Video Call', trust: 'Trust Score', profile: 'Profile'
  }[name] || '';
  if (name === 'browse') loadAllSkills();
  if (name === 'matches') loadMatches();
  if (name === 'connections') loadConnections();
  if (name === 'nearby') { loadNearby(); initMap(); if (map) setTimeout(() => map.invalidateSize(), 300); }
  if (name === 'trust') loadTrustScore();
  if (name === 'profile') loadProfileForm();
  if (name === 'video') loadCallHistory();
  // close mobile nav
  document.getElementById('topNav')?.classList.remove('open');
  
  if (name !== 'connections') updateConnectionBadge();
}

function logout() { localStorage.removeItem('token'); window.location.href = 'index.html'; }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); }
function initials(n) { return n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '?'; }
function timeAgo(d) { const x = Math.floor((Date.now() - new Date(d)) / 86400000); return x === 0 ? 'Today' : x === 1 ? 'Yesterday' : x + 'd ago'; }

// ─── SKILL CARD HTML ───
function skillCardHTML(skill, showDelete = false) {
  const user = skill.userId;
  const name = user?.name || 'Unknown';
  const email = user?.email || '';
  const langs = user?.languages && user.languages.length > 0 ? user.languages.join(', ') : 'English';
  return `<div class="skill-card">
    <div class="skill-header">
      <div class="skill-user">
        <div class="avatar-xs">${initials(name)}</div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span>${name}${user?.location ? ' · ' + user.location : ''}</span>
          <span style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">🗣️ ${langs}</span>
        </div>
      </div>
      ${showDelete ? `<button class="btn btn-danger" onclick="deleteSkill('${skill._id}')">Delete</button>` : ''}
    </div>
    <div class="skill-exchange">
      <span class="pill pill-offer">${skill.skillOffered}</span>
      <span class="pill-arrow">⇄</span>
      <span class="pill pill-want">${skill.skillWanted}</span>
    </div>
    ${skill.description ? `<p class="skill-desc">${skill.description}</p>` : ''}
    <div class="skill-footer">
      <span class="level-badge">${skill.level}</span>
      <span class="skill-date">${timeAgo(skill.createdAt)}</span>
    </div>
    ${showDelete ? `<button class="btn btn-danger-solid" style="margin-top:12px; width:100%; padding:8px;" onclick="deleteSkill('${skill._id}')">Delete Skill</button>` : ''}
    ${!showDelete && skill.userId?._id ? `
      ${connectedUserIds.includes(skill.userId._id) ? `
        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
          <div class="video-call-link" onclick="startVideoCall('${skill.userId._id}')">Video Call</div> 
          <div class="video-call-link" style="color:var(--amber); border-color:var(--amber);" onclick="rateUser('${skill.userId._id}', '${name.replace(/'/g, "\\'")}')">Rate User</div>
          <div class="video-call-link" style="color:#00c6ff; border-color:#00c6ff;" onclick="showReviews('${skill.userId._id}', '${name.replace(/'/g, "\\'")}', '${user?.trustScore||0}')">Reviews</div>
        </div>
      ` : `
        <button class="btn btn-primary" style="margin-top:12px; width:100%; padding:8px;" onclick="requestConnection('${skill.userId._id}', '${skill._id}')">Connect Request</button>
        <div style="display:flex; justify-content:center; margin-top:12px;">
          <div class="video-call-link" style="color:#00c6ff; border-color:#00c6ff; width:100%; text-align:center;" onclick="showReviews('${skill.userId._id}', '${name.replace(/'/g, "\\'")}', '${user?.trustScore||0}')">Read Reviews</div>
        </div>
      `}
    ` : ''}
  </div>`;
}

// ─── PROFILE ───
async function loadProfile() {
  try {
    const res = await fetch(`${API}/user/profile`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) return;
    userProfile = data;
    document.getElementById('profileName').textContent = data.name;
    document.getElementById('profileEmail').textContent = data.email;
    document.getElementById('profileAvatar').textContent = initials(data.name);
    document.getElementById('navUserName').textContent = data.name;
    document.getElementById('navUserEmail').textContent = data.email;
    document.getElementById('navAvatar').textContent = initials(data.name);
  } catch {}
}

// ─── MY SKILLS ───
async function loadMySkills() {
  try {
    const res = await fetch(`${API}/skills/my`, { headers: authHeaders });
    const data = await res.json();
    const list = document.getElementById('mySkillsList');
    if (!res.ok) throw new Error(data.message);
    if (data.length === 0) {
      list.innerHTML = `<div class="empty"><h3>No skills yet</h3><p>Add your first skill above to get started.</p></div>`;
      return;
    }
    if (!userProfile) await loadProfile();
    const enriched = data.map(s => ({ ...s, userId: userProfile }));
    list.innerHTML = enriched.map(s => skillCardHTML(s, true)).join('');
  } catch (err) { toast(err.message, 'error'); }
}

let isBrowseFilterActive = false;

function applyBrowseFilter() {
  isBrowseFilterActive = document.getElementById('browseFilterToggle').checked;
  if (typeof SFX !== 'undefined') {
    isBrowseFilterActive ? SFX.toggleOn() : SFX.toggleOff();
  }
  loadAllSkills();
}

async function loadAllSkills() {
  try {
    const res = await fetch(`${API}/skills/all`, { headers: authHeaders });
    let data = await res.json();
    const list = document.getElementById('allSkillsList');
    if (!res.ok) throw new Error(data.message);
    if (data.length === 0) { list.innerHTML = `<div class="empty"><h3>No skills posted yet</h3><p>Be the first to add a skill!</p></div>`; return; }
    
    // Apply "Show Only What I Want to Learn" Filter
    if (isBrowseFilterActive) {
      const myRes = await fetch(`${API}/skills/my`, { headers: authHeaders });
      const myData = await myRes.json();
      
      if (myRes.ok && myData.length > 0) {
        // Strict flipped match logic per card
        data = data.filter(skill => {
          const theirOffered = skill.skillOffered.toLowerCase();
          const theirWanted = skill.skillWanted.toLowerCase();
          
          return myData.some(mySkill => {
            const myOffered = mySkill.skillOffered.toLowerCase();
            const myWanted = mySkill.skillWanted.toLowerCase();
            
            const offersWhatIWant = theirOffered.includes(myWanted) || myWanted.includes(theirOffered);
            const wantsWhatIOffer = theirWanted.includes(myOffered) || myOffered.includes(theirWanted);
            
            return offersWhatIWant && wantsWhatIOffer;
          });
        });
      } else {
        toast("Add your own skills first to use this filter!", "error");
        document.getElementById('browseFilterToggle').checked = false;
        isBrowseFilterActive = false;
      }
    }

    if (data.length === 0) { 
      list.innerHTML = `<div class="empty"><h3>No matching skills found</h3><p>Try turning off the filter to explore more.</p></div>`; 
      return; 
    }
    
    await fetchConnectedUsers();
    list.innerHTML = data.map(s => skillCardHTML(s)).join('');
  } catch (err) { toast(err.message, 'error'); }
}

async function loadMatches() {
  try {
    const res = await fetch(`${API}/skills/matches`, { headers: authHeaders });
    const data = await res.json();
    const list = document.getElementById('matchesList');
    if (!res.ok) throw new Error(data.message);
    const matches = data.matches || [];
    if (matches.length === 0) { list.innerHTML = `<div class="empty"><h3>No matches yet</h3><p>Add more skills — matches are based on mutual skill exchange.</p></div>`; return; }
    
    await fetchConnectedUsers();
    
    list.innerHTML = matches.map(s => `<div class="skill-card match-card">
      <div class="skill-header"><div class="skill-user"><div class="avatar-xs">${initials(s.userId?.name)}</div>${s.userId?.name || 'Unknown'}${s.userId?.location ? ' · ' + s.userId.location : ''}</div></div>
      <div class="skill-exchange"><span class="pill pill-offer">${s.skillOffered}</span><span class="pill-arrow">⇄</span><span class="pill pill-want">${s.skillWanted}</span></div>
      ${s.description ? `<p class="skill-desc">${s.description}</p>` : ''}
      <div class="skill-footer"><span class="level-badge">${s.level}</span><span class="skill-date">${timeAgo(s.createdAt)}</span></div>
      ${s.userId?._id ? `
        ${connectedUserIds.includes(s.userId._id) ? `
          <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
            <div class="video-call-link" onclick="startVideoCall('${s.userId._id}')">Video Call</div> 
            <div class="video-call-link" style="color:var(--amber); border-color:var(--amber);" onclick="rateUser('${s.userId._id}', '${(s.userId.name||'').replace(/'/g, "\\'")}')">Rate User</div>
            <div class="video-call-link" style="color:#00c6ff; border-color:#00c6ff;" onclick="showReviews('${s.userId._id}', '${(s.userId.name||'').replace(/'/g, "\\'")}', '${s.userId.trustScore||0}')">Reviews</div>
          </div>
        ` : `
          <button class="btn btn-primary" style="margin-top:12px; width:100%; padding:8px;" onclick="requestConnection('${s.userId._id}', '${s._id}')">Connect Request</button>
          <div style="display:flex; justify-content:center; margin-top:12px;">
            <div class="video-call-link" style="color:#00c6ff; border-color:#00c6ff; width:100%; text-align:center;" onclick="showReviews('${s.userId._id}', '${(s.userId.name||'').replace(/'/g, "\\'")}', '${s.userId.trustScore||0}')">Read Reviews</div>
          </div>
        `}
      ` : ''}
    </div>`).join('');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SAFETY CHECK (Frontend) ───
const bannedKeywords = [
  'porn', 'sex', 'nude', 'nsfw', 'prostitution', 'escort',
  'murder', 'kill', 'suicide', 'terrorist', 'assassinate',
  'bomb', 'gun', 'rifle', 'explosive', 'making of guns', 'build a bomb',
  'cocaine', 'heroin', 'meth', 'lsd', 'fentanyl', 'buy drugs', 'sell drugs',
  'nazi', 'kkk', 'slur'
];

function containsBannedKeywords(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  for (const keyword of bannedKeywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    if (regex.test(lowerText)) return true;
  }
  return false;
}

function showSafetyWarning(chancesLeft, banHours = 10) {
    if (typeof SFX !== 'undefined') SFX.warning();
    const overlay = document.getElementById('safetyWarningOverlay');
    overlay.style.display = 'flex';
    const countdownEl = document.getElementById('safetyWarningCountdown');
    const msgEl = document.getElementById('safetyWarningMessage');
  
  if (chancesLeft > 0) {
    msgEl.innerHTML = `Your input contains restricted keywords.<br><br>
    <strong style="color:#fff;">You have ${chancesLeft} more chance${chancesLeft === 1 ? '' : 's'} not to use banned keywords. If you continue, your account will be banned.</strong>`;
  } else {
    // Modify the header as well for the ban state
    overlay.querySelector('h2').textContent = "Account Banned";
    msgEl.innerHTML = `For severe safety policy violations, your account has been temporarily banned.<br><br>
    <strong style="color:#fff; font-size: 20px;">Time remaining: ${banHours} hours</strong><br><br>
    Logging you out in...`;
  }

  overlay.style.display = 'flex';
  
  let seconds = 5;
  countdownEl.textContent = seconds;
  
  const interval = setInterval(() => {
    seconds--;
    countdownEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(interval);
      if (chancesLeft > 0) {
        overlay.style.display = 'none';
      } else {
        logout();
      }
    }
  }, 1000);
}

async function addSkill() {
  if (typeof SFX !== 'undefined') SFX.click();
  const skillOffered = document.getElementById('skillOffered').value.trim();
  const skillWanted = document.getElementById('skillWanted').value.trim();
  const level = document.getElementById('skillLevel').value;
  const description = document.getElementById('skillDesc').value.trim();
  
  if (!skillOffered || !skillWanted) return toast("Please fill in both skill fields", 'error');

  try {
    const res = await fetch(`${API}/skills/add`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ skillOffered, skillWanted, level, description }) });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) {
        if (data.banned) return showSafetyWarning(0, data.timeRemaining || 10);
        if (data.warning) return showSafetyWarning(data.chancesLeft);
      }
      throw new Error(data.message);
    }
    toast("Skill added!");
    if (typeof SFX !== 'undefined') SFX.success();
    document.getElementById('skillOffered').value = '';
    document.getElementById('skillWanted').value = '';
    document.getElementById('skillDesc').value = '';
    loadMySkills();
    checkNewMatches(); // Re-check matches after adding a skill
  } catch (err) {
      if (typeof SFX !== 'undefined') SFX.error();
      toast(err.message, 'error'); 
  }
}

async function deleteSkill(id) {
  if (!confirm("Delete this skill?")) return;
  try {
    const res = await fetch(`${API}/skills/${id}`, { method: 'DELETE', headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast("Skill deleted"); loadMySkills();
    checkNewMatches(); // Re-check matches after deleting a skill
  } catch (err) { toast(err.message, 'error'); }
}

let previousMatchCount = 0;
async function checkNewMatches() {
  try {
    const res = await fetch(`${API}/skills/matches`, { headers: authHeaders });
    if (!res.ok) return;
    const data = await res.json();
    const matchCount = data.matches ? data.matches.length : 0;
    const badge = document.getElementById('matchBadge');
    
    if (matchCount > 0) {
      badge.textContent = matchCount > 99 ? '99+' : matchCount;
      badge.style.display = 'inline-block';
      if (matchCount > previousMatchCount) {
        toast(`You have ${matchCount} perfect match${matchCount > 1 ? 'es' : ''}!`);
      }
    } else {
      badge.style.display = 'none';
    }
    previousMatchCount = matchCount;
  } catch (err) { console.error("Error checking matches:", err); }
}

// ─── MAP (Leaflet + OpenStreetMap) ───
function initMap() {
  if (map) return;
  const el = document.getElementById('mapElement');
  if (!el) return;
  map = L.map('mapElement').setView([20.5937, 78.9629], 5); // default: India center
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 18
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  setTimeout(() => map.invalidateSize(), 300);
}

function createIcon(color, label) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0a0a0f;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.4);">${label}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
  });
}

async function setLocation() {
  const location = document.getElementById('locationInput').value.trim();
  const status = document.getElementById('locationStatus');
  if (!location) return toast("Enter a location first", 'error');
  status.textContent = "Geocoding...";
  try {
    const res = await fetch(`${API}/geo/location`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ location }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    status.innerHTML = `<span style="color:var(--accent)">✓ ${data.resolvedAs}</span>`;
    toast("Location updated!");
    await loadProfile(); // refresh coordinates for map
    loadNearby();
  } catch (err) { status.textContent = ''; toast(err.message, 'error'); }
}

async function loadNearby() {
  const r = document.getElementById('radiusInput')?.value || 50;
  const list = document.getElementById('nearbyList');
  list.innerHTML = '<div class="loading-text">Finding nearby skills…</div>';
  try {
    const res = await fetch(`${API}/geo/nearby-skills?radius=${r}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // Update map
    if (map && markersLayer) {
      markersLayer.clearLayers();
      // User marker
      if (userProfile?.coordinates?.lat) {
        const myMarker = L.marker([userProfile.coordinates.lat, userProfile.coordinates.lng], { icon: createIcon('#3b82f6', '') })
          .bindPopup(`<b>You</b><br>${userProfile.location || ''}`);
        markersLayer.addLayer(myMarker);
        map.setView([userProfile.coordinates.lat, userProfile.coordinates.lng], 10);
        // Radius circle
        L.circle([userProfile.coordinates.lat, userProfile.coordinates.lng], {
          radius: r * 1000, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.06, weight: 1
        }).addTo(markersLayer);
      }
      // Skill markers
      data.skills?.forEach(s => {
        if (s.user?.coordinates?.lat) {
          const m = L.marker([s.user.coordinates.lat, s.user.coordinates.lng], { icon: createIcon('#5b9cf5', initials(s.user.name)) })
            .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px;">
              <b>${s.user.name}</b><br>
              <span style="color:#3b82f6">Offers:</span> ${s.skillOffered}<br>
              <span style="color:#f0b542">Wants:</span> ${s.skillWanted}<br>
              <small>${s.distanceKm} km away · Trust: ${s.user.trustScore}</small>
            </div>`);
          markersLayer.addLayer(m);
        }
      });
    }

    if (!data.skills || data.skills.length === 0) {
      list.innerHTML = `<div class="empty"><h3>No nearby skills</h3><p>Try increasing the radius or ask others to set their location.</p></div>`;
      return;
    }
    
    await fetchConnectedUsers();
    
    list.innerHTML = data.skills.map(s => {
      const userLangs = s.user.languages && s.user.languages.length > 0 ? s.user.languages.join(', ') : 'English';
      return `<div class="skill-card">
      <div class="skill-header">
        <div class="skill-user">
          <div class="avatar-xs">${initials(s.user.name)}</div>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span>${s.user.name} · <span class="skill-dist">${s.distanceKm} km</span></span>
            <span style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">🗣️ ${userLangs}</span>
          </div>
        </div>
        <span class="trust-label">Trust ${s.user.trustScore}</span>
      </div>
      <div class="skill-exchange"><span class="pill pill-offer">${s.skillOffered}</span><span class="pill-arrow">⇄</span><span class="pill pill-want">${s.skillWanted}</span></div>
      ${s.description ? `<p class="skill-desc">${s.description}</p>` : ''}
      <div class="skill-footer"><span class="level-badge">${s.level}</span><span class="skill-date">${timeAgo(s.createdAt)}</span></div>
      ${s.user?._id ? `
        ${connectedUserIds.includes(s.user._id) ? `
          <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
            <div class="video-call-link" onclick="startVideoCall('${s.user._id}')">Video Call</div> 
            <div class="video-call-link" style="color:var(--amber); border-color:var(--amber);" onclick="rateUser('${s.user._id}', '${(s.user.name||'').replace(/'/g, "\\'")}')">Rate User</div>
            <div class="video-call-link" style="color:#00c6ff; border-color:#00c6ff;" onclick="showReviews('${s.user._id}', '${(s.user.name||'').replace(/'/g, "\\'")}', '${s.user.trustScore||0}')">Reviews</div>
          </div>
        ` : `
          <button class="btn btn-primary" style="margin-top:12px; width:100%; padding:8px;" onclick="requestConnection('${s.user._id}', '${s._id}')">Connect Request</button>
          <div style="display:flex; justify-content:center; margin-top:12px;">
            <div class="video-call-link" style="color:#00c6ff; border-color:#00c6ff; width:100%; text-align:center;" onclick="showReviews('${s.user._id}', '${(s.user.name||'').replace(/'/g, "\\'")}', '${s.user.trustScore||0}')">Read Reviews</div>
          </div>
        `}
      ` : ''}
    </div>`;
    }).join('');
  } catch (err) { list.innerHTML = `<div class="empty"><p>${err.message}</p></div>`; }
}

// ─── TRUST SCORE ───
function trustColor(s) { return s >= 70 ? 'var(--accent)' : s >= 40 ? 'var(--amber)' : 'var(--danger)'; }

async function loadTrustScore() {
  const card = document.getElementById('trustScoreCard');
  try {
    const res = await fetch(`${API}/trust/my-score`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const bd = data.breakdown;
    const stars = '★'.repeat(Math.round(data.averageRating)) || '—';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:24px;margin-bottom:20px;flex-wrap:wrap;">
        <div><div class="trust-big" style="color:${trustColor(data.trustScore)}">${data.trustScore}</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">Trust Score / 100</div></div>
        <div style="flex:1;min-width:200px;">
          <div class="trust-bar-bg"><div class="trust-bar-fill" style="width:${data.trustScore}%;background:${trustColor(data.trustScore)};"></div></div>
          <div style="font-size:13px;color:var(--text-dim);">Rating: ${data.averageRating > 0 ? data.averageRating + ' ' + stars : 'No ratings'} · ${data.totalRatings} review${data.totalRatings !== 1 ? 's' : ''}</div>
          ${data.isFlagged ? `<div class="flag-banner">⚠ Flagged: ${data.flagReason}</div>` : ''}
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:16px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:12px;">Score Breakdown</div>
        <div class="score-grid">
          ${[['Ratings',bd.ratingScore,40],['Experience',bd.experienceScore,20],['Account Age',bd.ageScore,20],['Activity',bd.activityScore,20]].map(([l,v,m])=>`
          <div class="score-item"><div class="score-item-label">${l}</div><div class="score-item-val">${v}<span class="score-item-max">/${m}</span></div></div>`).join('')}
        </div>
      </div>
      ${data.recentRatings?.length > 0 ? `<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;">Recent Reviews</div>
        ${data.recentRatings.map(r=>`<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span style="font-weight:600;">${r.fromUser?.name||'User'}</span> — ${'★'.repeat(r.score)} ${r.review?`<br><span style="color:var(--text-dim)">${r.review}</span>`:''}</div>`).join('')}
      </div>` : ''}`;
  } catch (err) { card.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
}

async function submitRating() {
  if (typeof SFX !== 'undefined') SFX.click();
  const toUserId = document.getElementById('rateUserId').value.trim();
  const score = parseInt(document.getElementById('rateScore').value);
  const review = document.getElementById('rateReview').value.trim();
  if (!toUserId) return toast("Please select a user to rate first", 'error');
  try {
    const res = await fetch(`${API}/trust/rate`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ toUserId, score, review }) });
    const data = await res.json();
    if (res.ok) {
        toast("Rating submitted!");
        if (typeof SFX !== 'undefined') SFX.success();
        document.getElementById('rateUserId').value = ''; document.getElementById('rateReview').value = '';
        loadTrustScore();
    } else {
        throw new Error(data.message);
    }
  } catch (err) { toast(err.message, 'error'); }
}

function rateUser(userId, userName) {
  document.getElementById('rateUserId').value = userId;
  document.getElementById('rateUserNameDisplay').textContent = userName;
  document.getElementById('rateUserNameDisplay').style.color = '#fff';
  switchSection('trust');
  setTimeout(() => document.getElementById('rateReview').focus(), 100);
}

// ─── PROFILE EDIT ───
async function loadProfileForm() {
  if (!userProfile) await loadProfile();
  if (userProfile) {
    document.getElementById('editName').value = userProfile.name || '';
    document.getElementById('editBio').value = userProfile.bio || '';
    document.getElementById('editLocation').value = userProfile.location || '';
    
    // Set selected languages on pills
    const userLangs = userProfile.languages || ['English'];
    document.querySelectorAll('#editLanguages .lang-pill').forEach(pill => {
      if (userLangs.includes(pill.dataset.lang)) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }
}

async function updateProfile() {
  if (typeof SFX !== 'undefined') SFX.click();
  const name = document.getElementById('editName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  const location = document.getElementById('editLocation').value.trim();
  
  // Get selected languages from pills
  const selectedPills = document.querySelectorAll('#editLanguages .lang-pill.active');
  const languages = Array.from(selectedPills).map(pill => pill.dataset.lang);

  try {
    const res = await fetch(`${API}/user/profile`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ name, bio, location, languages }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast("Profile updated successfully!");
    if (typeof SFX !== 'undefined') SFX.success();
    await loadProfile();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── VIDEO CALL (Jitsi Meet + Socket.IO) ───
let activeVideoCall = false;
let currentCallId = null;
let callTimerInterval = null;
let callStartTime = null;
let incomingCallData = null;

// ─── RINGTONE SYNTHESIS ───
let audioCtx = null;
let ringtoneInterval = null;

function playRingtone() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    function ring() {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440; // standard dial/ring tone base
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + 1.2);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.3);
    }
    
    ring(); // Play first ring
    ringtoneInterval = setInterval(ring, 3000); // Repeat every 3 seconds
  } catch(e) { console.error("Audio blocked:", e); }
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

// Socket.IO connection (relative, auto-detects host)
const socket = io();

function initSocket() {
  if (!userProfile) return;

  socket.emit('register', userProfile._id);

  socket.on('incoming-call', (data) => {
    console.log('Incoming call:', data);
    incomingCallData = data;
    showIncomingCallPopup(data);
  });

  socket.on('call-response', (data) => {
    if (data.action === 'accepted') {
      toast(`${data.receiver.name} accepted your call!`);
    } else if (data.action === 'declined') {
      toast(`${data.receiver.name} declined your call`, 'error');
      endVideoCall(true); // silent end, don't hit API again
    }
  });

  socket.on('call-ended', (data) => {
    if (activeVideoCall && currentCallId === data.callId) {
      toast("The other person ended the call");
      endVideoCall(true);
    }
  });

  socket.on('connection-accepted', (data) => {
    toast(`${data.receiverName} has accepted your friend request!`);
    loadConnections(); // refresh the connection list to show them in friends!
    updateConnectionBadge();
  });

  socket.on('force-disconnect', (data) => {
    toast(data.reason || "Call terminated due to policy violation", 'error');
    endVideoCall(true);
    showSafetyWarning(0, 10);
  });

  socket.on('new-skill', (data) => {
    const senderId = data.userId && data.userId._id ? data.userId._id : data.userId;
    const senderName = data.userId && data.userId.name ? data.userId.name : data.userName;
    
    // Only show if it's from someone else
    if (userProfile && senderId !== userProfile._id) {
      toast(`🚀 New skill just added: ${data.skillOffered} (by ${senderName})!`);
      
      // Generate the HTML for the new card instantly
      const cardHtml = typeof skillCardHTML === 'function' ? skillCardHTML(data) : '';
      
      // Auto-inject instantly if lists are active
      if (cardHtml && document.getElementById('browseSection')?.classList.contains('active')) {
        const list = document.getElementById('allSkillsList');
        if (list) {
            const empty = list.querySelector('.empty');
            if (empty) empty.remove();
            list.insertAdjacentHTML('afterbegin', cardHtml);
        }
      }
      
      if (cardHtml && document.getElementById('nearbySection')?.classList.contains('active')) {
        const list = document.getElementById('nearbyList');
        if (list) {
            const empty = list.querySelector('.empty');
            if (empty) empty.remove();
            list.insertAdjacentHTML('afterbegin', cardHtml);
        }
      }
    }
  });
}

async function startAudioModeration() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    
    audioRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && activeVideoCall) {
        socket.emit("audio-chunk", {
          audioBuffer: event.data,
          userId: userProfile._id,
          language: currentCallLanguage
        });
      }
    };
    
    // Record in 5-second chunks
    audioRecorder.start(5000);
  } catch (err) {
    console.warn("Could not start audio moderation:", err);
  }
}

function stopAudioModeration() {
  if (audioRecorder && audioRecorder.state !== "inactive") {
    audioRecorder.stop();
  }
  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
    audioStream = null;
  }
}

function showIncomingCallPopup(data) {
  if (typeof SFX !== 'undefined') SFX.callRing();
  const overlay = document.getElementById('incomingCallOverlay');
  document.getElementById('incomingCallerName').textContent = data.caller.name;
  document.getElementById('incomingCallerAvatar').textContent = initials(data.caller.name);
  overlay.style.display = 'flex';
  
  playRingtone(); // Start ringing

  // Auto-dismiss after 30s
  if (window._incomingCallTimeout) clearTimeout(window._incomingCallTimeout);
  window._incomingCallTimeout = setTimeout(() => {
    if (overlay.style.display === 'flex') {
      hideIncomingCallPopup();
      toast("Missed call from " + data.caller.name, 'error');
    }
  }, 30000);
}

function hideIncomingCallPopup() {
  if (typeof SFX !== 'undefined') SFX.callRingStop();
  const overlay = document.getElementById('incomingCallOverlay');
  overlay.style.display = 'none';
  if (window._incomingCallTimeout) clearTimeout(window._incomingCallTimeout);
  stopRingtone(); // Stop ringing
  incomingCallData = null;
}

let pendingCallAction = null;
let pendingCallData = null;
let currentCallLanguage = "English";

// Make call language pills selectable (single select for the call)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#callLanguages .lang-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#callLanguages .lang-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
});

function showCallLanguageModal(action, data) {
  pendingCallAction = action;
  pendingCallData = data;
  
  // Pre-select user's first preferred language if available
  if (userProfile && userProfile.languages && userProfile.languages.length > 0) {
    const prefLang = userProfile.languages[0];
    document.querySelectorAll('#callLanguages .lang-pill').forEach(p => {
      if (p.dataset.lang === prefLang) p.classList.add('active');
      else p.classList.remove('active');
    });
  }

  document.getElementById('callLanguageOverlay').style.display = 'flex';
}

function cancelCallLanguage() {
  if (typeof SFX !== 'undefined') SFX.modalClose();
  document.getElementById('callLanguageOverlay').style.display = 'none';
  pendingCallAction = null;
  pendingCallData = null;
}

function confirmCallLanguage() {
  const activePill = document.querySelector('#callLanguages .lang-pill.active');
  if (activePill) {
    currentCallLanguage = activePill.dataset.lang;
  }
  
  document.getElementById('callLanguageOverlay').style.display = 'none';
  
  if (pendingCallAction === 'initiate') {
    proceedStartVideoCall(pendingCallData);
  } else if (pendingCallAction === 'accept') {
    proceedAcceptIncomingCall();
  }
}

async function acceptIncomingCall() {
  if (!incomingCallData) return;
  if (typeof SFX !== 'undefined') SFX.callAccept();
  hideIncomingCallPopup(); // hide the ringing popup
  showCallLanguageModal('accept', incomingCallData);
}

async function proceedAcceptIncomingCall() {
  const data = pendingCallData;

  try {
    const res = await fetch(`${API}/video/respond`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ callId: data.callId, action: 'accepted' })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message);

    // Start the call
    currentCallId = data.callId;
    currentVideoPartnerId = data.caller._id || data.caller.id;
    currentVideoPartnerName = data.caller.name;
    switchSection('video');
    document.getElementById('videoCallIdle').style.display = 'none';
    document.getElementById('videoCallActive').style.display = 'block';
    document.getElementById('videoCallPartner').textContent = data.caller.name;

    const displayName = encodeURIComponent(userProfile?.name || 'User');
    document.getElementById('jitsiFrame').src = jitsiUrl;
    activeVideoCall = true;
    startCallTimer();
    startAudioModeration();
    toast(`Video call with ${data.caller.name} started!`);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function declineIncomingCall() {
  if (!incomingCallData) return;
  const data = incomingCallData;
  hideIncomingCallPopup();

  try {
    await fetch(`${API}/video/respond`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ callId: data.callId, action: 'declined' })
    });
    toast("Call declined");
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function startVideoCall(targetUserId) {
  if (!targetUserId) return toast("No user ID provided", 'error');
  showCallLanguageModal('initiate', targetUserId);
}

async function proceedStartVideoCall(targetUserId) {
  try {
    toast("Calling…");
    const res = await fetch(`${API}/video/create-room`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.message && data.message.includes("online right now")) {
        document.getElementById('offlineUserOverlay').style.display = 'flex';
        return;
      }
      throw new Error(data.message);
    }

    currentCallId = data.callId;
    currentVideoPartnerId = data.targetUser.id || data.targetUser._id;
    currentVideoPartnerName = data.targetUser.name;

    // Switch to video section
    switchSection('video');

    // Show active call UI
    document.getElementById('videoCallIdle').style.display = 'none';
    document.getElementById('videoCallActive').style.display = 'block';
    document.getElementById('videoCallPartner').textContent = data.targetUser.name;

    // Build Jitsi URL with config
    const displayName = encodeURIComponent(data.currentUser.name);
    const jitsiUrl = `https://${data.jitsiDomain}/${data.roomName}#userInfo.displayName="${displayName}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.SHOW_JITSI_WATERMARK=false`;

    document.getElementById('jitsiFrame').src = jitsiUrl;
    activeVideoCall = true;
    startCallTimer();
    startAudioModeration();
    toast(`Calling ${data.targetUser.name}…`);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function endVideoCall(silent = false) {
  // Notify server
  if (!silent && currentCallId) {
    if (typeof SFX !== 'undefined') SFX.callDecline();
    try {
      await fetch(`${API}/video/end`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ callId: currentCallId })
      });
    } catch {}
  }

  const partnerId = currentVideoPartnerId;
  const partnerName = currentVideoPartnerName;

  document.getElementById('jitsiFrame').src = '';
  document.getElementById('videoCallIdle').style.display = 'block';
  document.getElementById('videoCallActive').style.display = 'none';
  document.getElementById('videoCallPartner').textContent = '—';
  activeVideoCall = false;
  currentVideoPartnerId = null;
  currentVideoPartnerName = null;
  stopCallTimer();
  stopAudioModeration();
  loadCallHistory(); // Refresh history

  // Automatically open rating window for the opposite user
  if (partnerId && partnerName) {
    document.getElementById('rateReview').placeholder = `Share your experience and rate ${partnerName}...`;
    rateUser(partnerId, partnerName);
  } else if (!silent) {
    toast("Video call ended");
  }
}

// ─── CALL TIMER ───
function startCallTimer() {
  callStartTime = Date.now();
  const timerEl = document.getElementById('callTimer');
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  const timerEl = document.getElementById('callTimer');
  if (timerEl) timerEl.textContent = '00:00';
  callStartTime = null;
}

// ─── CALL HISTORY ───
function formatDuration(secs) {
  if (!secs || secs === 0) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatCallTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Today ${timeStr}`;
  if (diffDays === 1) return `Yesterday ${timeStr}`;
  if (diffDays < 7) return `${diffDays}d ago ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr;
}

async function loadCallHistory() {
  const list = document.getElementById('callHistoryList');
  if (!list) return;

  try {
    const res = await fetch(`${API}/video/history`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const calls = data.calls || [];
    if (calls.length === 0) {
      list.innerHTML = `<div class="empty"><h3>No calls yet</h3><p>Start a video call from any skill card to see your history here.</p></div>`;
      return;
    }

    const myId = userProfile?._id;

    list.innerHTML = calls.map(c => {
      const isOutgoing = c.caller?._id === myId;
      const otherUser = isOutgoing ? c.receiver : c.caller;
      const otherName = otherUser?.name || 'Unknown';
      const direction = isOutgoing ? '↗ Outgoing' : '↙ Incoming';
      const dirClass = isOutgoing ? 'outgoing' : 'incoming';
      const statusIcon = {
        accepted: '✓', declined: '✕', missed: '!', ended: '✓', ringing: ''
      }[c.status] || '';

      return `<div class="call-history-item">
        <div class="call-history-avatar ${dirClass}">${initials(otherName)}</div>
        <div class="call-history-details">
          <div class="call-history-name">${otherName} <span class="call-direction">${direction}</span></div>
          <div class="call-history-meta">
            <span class="call-status-badge ${c.status}">${statusIcon} ${c.status}</span>
            ${c.duration > 0 ? `<span class="call-history-duration">${formatDuration(c.duration)}</span>` : ''}
          </div>
        </div>
        <div class="call-history-time">${formatCallTime(c.createdAt)}</div>
        <div class="call-history-actions">
          <button class="call-history-btn" onclick="startVideoCall('${otherUser?._id}')">Call</button>
          <button class="call-history-btn" style="color:var(--amber); border-color:rgba(240,181,66,0.3);" onclick="rateUser('${otherUser?._id}', '${(otherName||'').replace(/'/g, "\\'")}')">Rate</button>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty"><p style="color:var(--danger);">${err.message}</p></div>`;
  }
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  if (token) {
    await loadProfile();
    loadMySkills();
    loadCallHistory();
    updateConnectionBadge();
    initSocket();
    
    // Fallback polling for matches and connections
    setInterval(checkNewMatches, 60000);
    setInterval(updateConnectionBadge, 60000);
  }
});

// ─── CONNECTIONS ───
async function requestConnection(receiverId, skillId) {
  try {
    const res = await fetch(`${API}/connections/request`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ receiverId, skillId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast(data.message);
    if (typeof SFX !== 'undefined') SFX.success();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function updateConnectionBadge() {
  try {
    const res = await fetch(`${API}/connections/pending`, { headers: authHeaders });
    if (!res.ok) return;
    const data = await res.json();
    const badge = document.getElementById('connBadge');
    if (data.incomingCount > 0) {
      badge.textContent = data.incomingCount > 99 ? '99+' : data.incomingCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    console.error("Error updating connection badge", err);
  }
}

async function loadConnections() {
  const incList = document.getElementById('incomingConnectionsList');
  const outList = document.getElementById('outgoingConnectionsList');
  const friendsList = document.getElementById('friendsList');
  
  if (incList) incList.innerHTML = '<div class="empty"><p>Loading...</p></div>';
  if (outList) outList.innerHTML = '<div class="empty"><p>Loading...</p></div>';
  if (friendsList) friendsList.innerHTML = '<div class="empty"><p>Loading...</p></div>';
  
  try {
    const [resPending, resAll] = await Promise.all([
      fetch(`${API}/connections/pending`, { headers: authHeaders }),
      fetch(`${API}/connections/all`, { headers: authHeaders })
    ]);
    
    if (!resPending.ok || !resAll.ok) throw new Error("Failed to load connections");
    
    const dataPending = await resPending.json();
    const allConns = await resAll.json();
    
    // ─── FRIENDS (ACCEPTED) ───
    const accepted = allConns.filter(c => c.status === 'accepted');
    if (friendsList) {
      if (accepted.length === 0) {
        friendsList.innerHTML = '<div class="empty"><p>No friends yet. Send or accept requests to connect!</p></div>';
      } else {
        friendsList.innerHTML = accepted.map(c => {
          // Determine who the friend is (the other user)
          const friend = (c.requester._id === userProfile._id) ? c.receiver : c.requester;
          return `
          <div class="skill-card" style="border: 1px solid var(--accent);">
            <div class="skill-header">
              <div class="skill-user"><div class="avatar-xs" style="background:var(--accent);">${initials(friend.name)}</div>${friend.name}</div>
              <span class="trust-label">Trust ${friend.trustScore || 0}</span>
            </div>
            <p style="font-size:13px; color:var(--text-dim); margin-top:10px;">
              Connected over <b>${c.skill.skillOffered}</b>
            </p>
            ${friend.email ? `
              <div style="margin-top:12px; padding:8px; background:rgba(0,198,255,0.1); border-radius:6px; text-align:center;">
                <a href="mailto:${friend.email}" style="color:var(--accent); text-decoration:none; font-weight:700;">Email: ${friend.email}</a>
              </div>
            ` : ''}
            <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
              <div class="video-call-link" onclick="startVideoCall('${friend._id}')">Video Call</div> 
              <div class="video-call-link" style="color:var(--amber); border-color:var(--amber);" onclick="rateUser('${friend._id}', '${(friend.name||'').replace(/'/g, "\\'")}')">Rate User</div>
            </div>
          </div>
        `}).join('');
      }
    }
    
    // ─── INCOMING ───
    if (incList) {
      if (dataPending.incoming.length === 0) {
        incList.innerHTML = '<div class="empty"><p>No pending requests.</p></div>';
      } else {
        incList.innerHTML = dataPending.incoming.map(c => `
          <div class="skill-card">
            <div class="skill-header">
              <div class="skill-user"><div class="avatar-xs">${initials(c.requester.name)}</div>${c.requester.name}</div>
              <span class="trust-label">Trust ${c.requester.trustScore || 0}</span>
            </div>
            <p style="font-size:13px; color:var(--text-dim); margin-top:10px;">
              Wants to connect over <b>${c.skill.skillOffered}</b>
            </p>
            <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
              <button class="btn btn-primary" style="flex:1" onclick="respondConnection('${c._id}', 'accepted')">Accept</button>
              <button class="btn btn-danger" style="flex:1" onclick="respondConnection('${c._id}', 'declined')">Decline</button>
              <button class="btn btn-secondary" style="flex:100%; margin-top:5px; background:transparent; border:1px solid var(--border); color:var(--text);" onclick="showReviews('${c.requester._id}', '${(c.requester.name||'').replace(/'/g, "\\'")}', '${c.requester.trustScore||0}')">Read Reviews</button>
            </div>
          </div>
        `).join('');
      }
    }
    
    // ─── OUTGOING ───
    if (outList) {
      if (dataPending.outgoing.length === 0) {
        outList.innerHTML = '<div class="empty"><p>No sent requests.</p></div>';
      } else {
        outList.innerHTML = dataPending.outgoing.map(c => `
          <div class="skill-card">
            <div class="skill-header">
              <div class="skill-user"><div class="avatar-xs">${initials(c.receiver.name)}</div>${c.receiver.name}</div>
            </div>
            <p style="font-size:13px; color:var(--text-dim); margin-top:10px;">
              Requested connection for <b>${c.skill.skillOffered}</b>
            </p>
            <div style="margin-top:16px; padding:8px; background:rgba(255,255,255,0.05); text-align:center; border-radius:6px; font-size:12px; font-weight:700; color:${c.status === 'pending' ? 'var(--amber)' : (c.status === 'accepted' ? 'var(--accent)' : 'var(--danger)')}; text-transform:uppercase;">
              Status: ${c.status}
            </div>
          </div>
        `).join('');
      }
    }
    
    updateConnectionBadge();
  } catch (err) {
    if (incList) incList.innerHTML = `<div class="empty"><p>${err.message}</p></div>`;
    if (outList) outList.innerHTML = `<div class="empty"><p>${err.message}</p></div>`;
  }
}

async function respondConnection(id, action) {
  try {
    const res = await fetch(`${API}/connections/${id}/respond`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast(`Connection ${action}!`);
    if (typeof SFX !== 'undefined') {
        if (action === 'accepted') SFX.success();
        else SFX.callDecline();
    }
    loadConnections(); // reload UI
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── REVIEWS ───
async function showReviews(userId, userName, trustScore) {
  if (typeof SFX !== 'undefined') SFX.modalOpen();
  document.getElementById('reviewsModalName').textContent = userName;
  document.getElementById('reviewsModalAvatar').textContent = initials(userName);
  document.getElementById('reviewsModalScore').textContent = trustScore;
  
  const list = document.getElementById('reviewsModalList');
  list.innerHTML = '<div class="empty"><p>Loading reviews...</p></div>';
  document.getElementById('reviewsModalOverlay').style.display = 'flex';
  
  try {
    const res = await fetch(`${API}/trust/ratings/${userId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    if (!data.ratings || data.ratings.length === 0) {
      list.innerHTML = '<div class="empty"><p>This user has no reviews yet.</p></div>';
      return;
    }
    
    list.innerHTML = data.ratings.map(r => `
      <div style="padding:16px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="font-size:14px;">${r.fromUser?.name || 'User'}</strong>
          <span style="color:var(--amber); font-size:12px;">${'★'.repeat(r.score)}${'☆'.repeat(5-r.score)}</span>
        </div>
        ${r.review ? `<p style="font-size:14px; color:var(--text-dim); margin:0; line-height:1.5;">"${r.review}"</p>` : ''}
        <div style="font-size:11px; color:#666; margin-top:8px;">${timeAgo(r.createdAt)}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty"><p>${err.message}</p></div>`;
  }
}

function closeReviewsModal() {
  if (typeof SFX !== 'undefined') SFX.modalClose();
  document.getElementById('reviewsModalOverlay').style.display = 'none';
}

// ================= OAUTH ONBOARDING =================
window.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('needsOnboarding') === 'true') {
        // Wait briefly for loadProfile to populate userProfile
        setTimeout(() => {
            if (userProfile && userProfile.name) {
                document.getElementById('onboardingName').value = userProfile.name;
            }
            document.getElementById('onboardingModalOverlay').style.display = 'flex';
        }, 500);
    }
});

function toggleOnboardingLanguage(pill) {
    const isActive = pill.classList.toggle('active');
    if (typeof SFX !== 'undefined') {
        isActive ? SFX.toggleOn() : SFX.toggleOff();
    }
}

async function submitOnboarding() {
  if (typeof SFX !== 'undefined') SFX.click();
    const name = document.getElementById('onboardingName').value.trim();
    if (!name) return toast('Please enter your display name.', 'error');

    const activePills = document.querySelectorAll('#onboardingLanguages .lang-pill.active');
    const selectedLangs = Array.from(activePills).map(p => p.dataset.lang);
    if (selectedLangs.length === 0) {
        return toast('Please select at least one language.', 'error');
    }
    
    const bio = document.getElementById('onboardingBio').value.trim();
    
    try {
        const res = await fetch(`${API}/user/profile`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({ name, languages: selectedLangs, bio })
        });
        if (res.ok) {
            toast('Profile updated successfully!');
            if (typeof SFX !== 'undefined') SFX.success();
            localStorage.removeItem('needsOnboarding');
            document.getElementById('onboardingModalOverlay').style.display = 'none';
            toast('Profile setup complete! Welcome to SkillSwap! 🎉');
            loadProfile(); // reload profile in UI
        } else {
            toast('Failed to save profile. Try again.', 'error');
        }
    } catch (err) {
        toast('Network error.', 'error');
    }
}
