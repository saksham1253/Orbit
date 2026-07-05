/**
 * shareCard.js — generates a shareable PNG of a rank-up moment on a <canvas>
 * (no server, no assets — organic-growth card per spec §8). Returns a data URL;
 * shareOrDownload() uses the Web Share API when available, else downloads.
 */
import { getTier, SKY } from './tiers';

const CATEGORY_GLOW = {
  moon: '180,172,158', planet: '216,164,127', star: '169,214,255',
  pulsar: '76,201,240', supernova: '255,107,53', galaxy: '255,143,207', quasar: '142,197,255',
};

export function buildShareCard({ tierId, score = null, city = '' }) {
  const W = 1200, H = 675;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tier = getTier(tierId);
  const glow = CATEGORY_GLOW[tier.category] || '142,197,255';

  // Deep-space backdrop.
  const bg = ctx.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H * 0.4, W * 0.75);
  bg.addColorStop(0, SKY.from); bg.addColorStop(0.6, SKY.mid); bg.addColorStop(1, SKY.to);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Starfield (deterministic-ish, fine for a one-off card).
  for (let i = 0; i < 160; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
    const y = (Math.sin(i * 78.233) * 12543.123 % 1 + 1) % 1 * H;
    const r = ((Math.sin(i * 3.7) + 1) / 2) * 1.6 + 0.2;
    ctx.globalAlpha = 0.2 + ((Math.sin(i * 5.1) + 1) / 2) * 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Glowing medallion with the tier emoji.
  const cx = W / 2, cy = H * 0.38, R = 110;
  const ring = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
  ring.addColorStop(0, `rgba(${glow},0.9)`);
  ring.addColorStop(0.6, `rgba(${glow},0.25)`);
  ring.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  ctx.font = '120px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tier.emoji, cx, cy + 6);

  // Headline.
  ctx.fillStyle = `rgba(${glow},0.9)`;
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('ASCENDED TO', cx, H * 0.62);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 52px system-ui, sans-serif';
  ctx.fillText(tier.displayName, cx, H * 0.71);

  // Sub-line.
  ctx.fillStyle = 'rgba(232,226,245,0.75)';
  ctx.font = '400 24px system-ui, sans-serif';
  const sub = [score != null ? `CosmicScore ${score}` : null, city ? `over ${city}'s sky` : null]
    .filter(Boolean).join('  ·  ');
  if (sub) ctx.fillText(sub, cx, H * 0.79);

  // Branding.
  ctx.fillStyle = 'rgba(232,226,245,0.55)';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('Orbit · Cosmic Leaderboard', cx, H * 0.9);

  return canvas.toDataURL('image/png');
}

/**
 * shareOrDownload — robust share ladder used by BOTH the rank-up and session
 * cards (B-06). The old version tried file-share then an <a download> click;
 * inside the Android WebView `canShare({files})` is false AND anchor-download is
 * a silent no-op, so the button appeared dead. This walks a proper fallback
 * ladder and ALWAYS returns a status so the caller can give visible feedback:
 *   1) native file share (mobile/desktop that support it)
 *   2) native text/URL share (WebViews that can't share files usually still can)
 *   3) desktop download + copy-link
 *
 * @returns {Promise<'shared'|'cancelled'|'downloaded'|'failed'>}
 */
export async function shareOrDownload(dataUrl, { filename = 'cosmic-rankup.png', text = '', url = '' } = {}) {
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.origin : '');

  // 1) Native FILE share.
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, url: shareUrl || undefined });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        // else fall through to text/url share
      }
    }
  } catch {
    /* fall through */
  }

  // 2) Native TEXT/URL share — the tier that rescues the APK WebView.
  if (navigator.share) {
    try {
      await navigator.share({ text, url: shareUrl || undefined });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      /* fall through to download */
    }
  }

  // 3) Desktop fallback: download the PNG + copy the link.
  try {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    if (shareUrl && navigator.clipboard) { try { await navigator.clipboard.writeText(shareUrl); } catch { /* clipboard optional */ } }
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
