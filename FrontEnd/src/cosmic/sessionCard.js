/**
 * sessionCard.js — generates a shareable PNG of a completed session (the
 * post-session ritual, Orbit Engine Tier 3). Pure client-side <canvas>, no
 * server, no assets — a viral loop card. Mirrors shareCard.js and reuses its
 * shareOrDownload() helper.
 */
import { SKY } from './tiers';
import { shareOrDownload } from './shareCard';

export { shareOrDownload };

// Wrap text to a max width, returning the lines (bounded).
function wrapLines(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // Ellipsize if we ran out of room.
  const used = words.join(' ');
  if (lines.join(' ').length < used.length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

/**
 * buildSessionCard — returns a PNG data URL.
 * @param {object} o { partnerName, rating (1-5), learned, durationSec }
 */
export function buildSessionCard({ partnerName = 'a partner', rating = 0, learned = '', durationSec = 0 }) {
  const W = 1200, H = 675;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Deep-space backdrop.
  const bg = ctx.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H * 0.4, W * 0.8);
  bg.addColorStop(0, SKY.from); bg.addColorStop(0.6, SKY.mid); bg.addColorStop(1, SKY.to);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Deterministic starfield.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 150; i++) {
    const x = ((Math.sin(i * 12.9898) * 43758.5453 % 1) + 1) % 1 * W;
    const y = ((Math.sin(i * 78.233) * 12543.123 % 1) + 1) % 1 * H;
    const r = ((Math.sin(i * 3.7) + 1) / 2) * 1.5 + 0.2;
    ctx.globalAlpha = 0.25 + ((Math.sin(i * 5.1) + 1) / 2) * 0.55;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';

  // Eyebrow.
  ctx.fillStyle = 'rgba(196,181,253,0.9)';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('ORBIT · SESSION COMPLETE', W / 2, 96);

  // Partner line.
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 52px system-ui, sans-serif';
  ctx.fillText(`A swap with ${partnerName}`, W / 2, 175);

  // Stars.
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  ctx.font = '48px system-ui, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full), W / 2, 258);

  // "What I learned" panel.
  if (learned && learned.trim()) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const px = 140, pw = W - px * 2, py = 300, ph = 210;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 22); else ctx.rect(px, py, pw, ph);
    ctx.fill();

    ctx.fillStyle = 'rgba(148,163,184,0.95)';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('WHAT I LEARNED', W / 2, py + 46);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '500 34px system-ui, sans-serif';
    const lines = wrapLines(ctx, `“${learned.trim()}”`, pw - 80, 3);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, py + 100 + i * 44));
  }

  // Duration + footer.
  const mins = Math.floor(durationSec / 60), secs = durationSec % 60;
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = '500 26px system-ui, sans-serif';
  ctx.fillText(`${mins}m ${secs}s of learning`, W / 2, 590);

  ctx.fillStyle = 'rgba(196,181,253,0.8)';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText('Trade skills. Rise through the cosmos.', W / 2, 634);

  return canvas.toDataURL('image/png');
}
