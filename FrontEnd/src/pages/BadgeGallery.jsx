/**
 * BadgeGallery — dev/QA route (/cosmic-gallery, not in nav) that renders all 25
 * cosmic tiers in BOTH themes side by side, in full and mini sizes. Used to
 * verify the dual-theme rule and WCAG AA contrast (spec §7, acceptance §19).
 *
 * The two theme columns set their OWN data-mode on a wrapper so the badge CSS
 * (which keys off [data-mode="light"]) reacts locally — letting us see the
 * light-mode rendering without touching the app's real theme.
 */
import { Helmet } from 'react-helmet-async';
import CosmicBadge from '../cosmic/CosmicBadge';
import { TIER_ORDER, getTier } from '../cosmic/tiers';

function ThemeColumn({ mode, label }) {
  const bg = mode === 'dark' ? '#0D0221' : '#F4F1FA';
  const fg = mode === 'dark' ? '#E8E2F5' : '#1A0B2E';
  const sub = mode === 'dark' ? '#9D92B8' : '#5A5270';
  const card = mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(13,2,33,0.04)';

  return (
    <div data-mode={mode} style={{ background: bg, color: fg, padding: '24px', borderRadius: 16, flex: 1, minWidth: 320 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{label}</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: sub }}>data-mode=&quot;{mode}&quot;</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {TIER_ORDER.map((tierId) => {
          const t = getTier(tierId);
          return (
            <div key={tierId} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '14px 10px', background: card, borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CosmicBadge tierId={tierId} size="full" />
                <CosmicBadge tierId={tierId} size="mini" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.displayName}</div>
                <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>{tierId}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BadgeGallery() {
  return (
    <>
      <Helmet><title>Cosmic Badge Gallery · SkillSwap</title></Helmet>
      <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>🛰️ Cosmic Badge Gallery</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 24 }}>
          All 25 tiers, full + mini, in both themes. Dev/QA route — verifies the dual-theme rule
          and that the shared &lt;defs&gt; sprite prevents blank badges when many render at once.
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <ThemeColumn mode="dark" label="Dark theme" />
          <ThemeColumn mode="light" label="Light theme" />
        </div>
      </div>
    </>
  );
}
