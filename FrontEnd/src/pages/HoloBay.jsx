/**
 * HoloBay.jsx — the Holo-Bay (/holobay): a try-before-you-buy lab for Nebula
 * Store cosmetics. Pick any item and it renders LIVE on a holographic mock of
 * your own profile — your real name carries the glow, the card wears the nebula
 * — so you see exactly what everyone else will see before you spend a Photon.
 *
 * Nothing here mutates server state until you press Buy or Equip; the preview is
 * pure client render (GlowName + cosmetics.css classes), identical to how the
 * look renders for other users (that's the whole point — see GlowName). Buy /
 * Equip reuse the same useShop mutations as the store, so balances and equipped
 * looks stay in sync app-wide.
 *
 * Reduced-motion / data-anim-off safe: the holo-scan and float are CSS-gated
 * (holobay.css); the cosmetic glows are already gated in cosmetics.css.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, ArrowLeft } from 'lucide-react';
import PhotonIcon from '../cosmic/PhotonIcon';
import GlowName from '../cosmic/GlowName';
import ItemIcon from '../cosmic/itemIcons';
import { useShop, useBuyCosmetic, useEquipCosmetic } from '../cosmic/useShop';
import { COSMETIC_RENDER, bgClassFor } from '../cosmic/cosmetics';
import { rarityOf, rarityVars, cardGlowClass, RARITY_ORDER } from '../cosmic/rarity';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import './holobay.css';

function Swatch({ item, size = 40 }) {
  const meta = COSMETIC_RENDER[item.key] || {};
  if (item.type === 'name_glow') return <span className={meta.glowClass} style={{ fontSize: 18 }}>Aa</span>;
  if (item.type === 'background' && meta.swatch)
    return <span className="inline-block rounded-md" style={{ width: size, height: size, background: meta.swatch }} />;
  return <ItemIcon item={item} size={size} color={rarityOf(item.rarity).color} />;
}

// Swatch grid for one cosmetic type. Hoisted (not defined in render) so React
// keeps its identity stable across renders.
function Picker({ title, items, activeKey, onPick, onClear, clearLabel }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
        <button onClick={onClear} className="text-[11px] font-semibold text-slate-500 hover:text-slate-300">{clearLabel}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <button
              key={it.key}
              onClick={() => onPick(it.key)}
              title={`${it.name} · ${rarityOf(it.rarity).label}`}
              style={rarityVars(it.rarity)}
              className={`relative grid h-14 w-14 place-items-center rounded-xl border transition
                ${active ? 'ring-2 ring-white/70 border-white/30' : 'border-white/10 hover:border-white/25'}`}
            >
              <span className="absolute inset-0 rounded-xl" style={{ background: 'rgba(18,20,33,.7)' }} />
              <span className="relative"><Swatch item={it} size={34} /></span>
              {it.owned && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[9px] text-white"><Check size={10} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HoloBay() {
  const { data } = useShop();
  const buy = useBuyCosmetic();
  const equip = useEquipCosmetic();
  const { addToast } = useUIStore();
  const authName = useAuthStore((s) => s.user?.name) || 'You';

  const catalog = useMemo(() => data?.catalog || [], [data]);
  const glows = useMemo(() => catalog.filter((c) => c.type === 'name_glow'), [catalog]);
  const backgrounds = useMemo(() => catalog.filter((c) => c.type === 'background'), [catalog]);

  // Currently PREVIEWED (not equipped) selections — default to what's equipped.
  const equippedGlow = data?.equipped?.name_glow || null;
  const equippedBg = data?.equipped?.background || null;
  const [tryGlow, setTryGlow] = useState(undefined); // undefined → fall back to equipped
  const [tryBg, setTryBg] = useState(undefined);

  const glowKey = tryGlow === undefined ? equippedGlow : tryGlow;
  const bgKey = tryBg === undefined ? equippedBg : tryBg;
  const glowItem = glows.find((g) => g.key === glowKey) || null;
  const bgItem = backgrounds.find((b) => b.key === bgKey) || null;

  const busy = buy.isPending || equip.isPending;
  const onBuy = (key) => buy.mutate(key, {
    onSuccess: (d) => addToast(`Purchased — ${d.spentPhotons ?? d.spent} Photons spent ✨`, 'success'),
    onError: (e) => addToast(e.response?.data?.message || 'Purchase failed', 'error'),
  });
  const onEquip = (type, key) => equip.mutate({ type, key }, {
    onSuccess: () => addToast(key ? 'Equipped' : 'Unequipped', 'info'),
    onError: (e) => addToast(e.response?.data?.message || 'Could not equip', 'error'),
  });

  // action row for whichever item the stage is currently wearing
  const stageActions = (item, type) => {
    if (!item) return null;
    if (item.equipped) return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><Check size={13} /> Equipped</span>
    );
    if (item.owned) return (
      <button onClick={() => onEquip(type, item.key)} disabled={busy}
        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20">Equip this</button>
    );
    return (
      <button onClick={() => onBuy(item.key)} disabled={busy || !item.affordable}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${item.affordable ? 'text-slate-900' : 'cursor-not-allowed bg-white/5 text-slate-500'}`}
        style={item.affordable ? { background: 'linear-gradient(90deg,#38bdf8,#8b5cf6,#ec4899)' } : undefined}>
        {item.affordable ? <PhotonIcon size={12} animated={false} /> : <Lock size={11} />} {item.cost.toLocaleString()}
      </button>
    );
  };

  if (!data) {
    return <div className="py-24 text-center text-slate-500">Warming up the Holo-Bay…</div>;
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{
        background:
          'radial-gradient(55% 45% at 20% 10%, rgba(56,189,248,.13), transparent 60%),' +
          'radial-gradient(55% 55% at 82% 18%, rgba(139,92,246,.16), transparent 62%),' +
          '#07080f',
      }} />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="flex items-center gap-3">
          <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Store</Link>
          <h1 className="ml-1 text-2xl font-black tracking-tight sm:text-3xl"
              style={{ background: 'linear-gradient(90deg,#38bdf8,#8b5cf6,#ec4899)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Holo-Bay
          </h1>
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-violet-400/40">
            <PhotonIcon size={15} />
            <span className="text-sm font-black tabular-nums text-violet-100">{(data.photons ?? data.stardust ?? 0).toLocaleString()}</span>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-slate-400">Try any look on a live hologram of your profile. Nothing is spent until you Buy or Equip.</p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── HOLOGRAM STAGE ── */}
          <div className="holobay-stage relative overflow-hidden rounded-3xl border border-cyan-400/20 p-6 sm:p-8">
            <div className="holobay-scan" aria-hidden="true" />
            <div className="relative mx-auto max-w-sm">
              {/* mock profile card wearing the previewed background */}
              <motion.div
                key={`${glowKey}|${bgKey}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                style={bgItem ? rarityVars(bgItem.rarity) : undefined}
                className={`holobay-float relative rounded-2xl border border-white/10 p-6 text-center ${bgClassFor(bgKey)} ${bgItem ? cardGlowClass(bgItem.rarity) : ''}`}
              >
                {/* avatar disc */}
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full ring-2 ring-white/20"
                     style={{ background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.12), rgba(3,5,12,.6))' }}>
                  <PhotonIcon size={34} />
                </div>
                <div className="mt-3 text-lg font-black">
                  <GlowName cosmeticGlowKey={glowKey}>{authName}</GlowName>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">This is exactly how others see you</div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-200">Mentor</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-200">Orbit</span>
                </div>
              </motion.div>

              {/* what the stage is wearing + inline actions */}
              <div className="mt-5 space-y-2">
                {glowItem && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                    <span className="rar-badge" style={rarityVars(glowItem.rarity)}>{rarityOf(glowItem.rarity).label}</span>
                    <span className="truncate text-sm font-semibold text-white">{glowItem.name}</span>
                    <span className="ml-auto">{stageActions(glowItem, 'name_glow')}</span>
                  </div>
                )}
                {bgItem && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                    <span className="rar-badge" style={rarityVars(bgItem.rarity)}>{rarityOf(bgItem.rarity).label}</span>
                    <span className="truncate text-sm font-semibold text-white">{bgItem.name}</span>
                    <span className="ml-auto">{stageActions(bgItem, 'background')}</span>
                  </div>
                )}
                {!glowItem && !bgItem && (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-center text-xs text-slate-500">
                    Pick a glow or nebula on the right to preview it here.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── PICKERS ── */}
          <div className="space-y-5">
            <Picker title="Name Glow" items={glows} activeKey={glowKey}
              onPick={(k) => setTryGlow(k === glowKey ? null : k)}
              onClear={() => setTryGlow(null)} clearLabel="None" />
            <Picker title="Profile Nebula" items={backgrounds} activeKey={bgKey}
              onPick={(k) => setTryBg(k === bgKey ? null : k)}
              onClear={() => setTryBg(null)} clearLabel="None" />

            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Rarity</div>
              <div className="flex flex-wrap gap-1.5">
                {RARITY_ORDER.slice(0, 12).map((r) => (
                  <span key={r.key} className="rar-badge" style={{ ...rarityVars(r.key), fontSize: 9, padding: '1px 6px' }}>{r.label}</span>
                ))}
              </div>
            </div>

            <Link to="/shop" className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-white/10">
              Browse the full Nebula Store →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
