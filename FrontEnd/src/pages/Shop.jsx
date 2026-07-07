/**
 * Shop.jsx — the Nebula Store (/shop). The SPEND destination of the Photon
 * economy: name-glows, profile nebulae and (as the backend grows) frames,
 * cursors, titles, boosts and bundles — each stamped with one of the 15 cosmic
 * rarity tiers (cosmic/rarity.js). Purchases and equips go through useShop, so
 * the Photons balance and equipped look update everywhere at once.
 *
 * Design tokens are taken verbatim from the Nebula Store spec: near-black
 * (#07080f) field with three radial nebula glows, a sky→violet→pink brand
 * gradient, glassy cards, a featured rail with a live countdown, and a rarity
 * legend. Every animation is reduced-motion / data-anim-off safe (rarity.css).
 *
 * Try-before-you-buy (Holo-Bay) is Phase 3 — the "Preview" affordance here is
 * wired to a local preview for now and will deep-link into /holobay when it ships.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, Sparkles as SparkIcon, FlaskConical } from 'lucide-react';
import PhotonIcon from '../cosmic/PhotonIcon';
import ItemIcon from '../cosmic/itemIcons';
import { useShop, useBuyCosmetic, useEquipCosmetic } from '../cosmic/useShop';
import { COSMETIC_RENDER } from '../cosmic/cosmetics';
import { rarityOf, rarityVars, cardGlowClass, RARITY_ORDER, LIVE_TIERS } from '../cosmic/rarity';
import { useUIStore } from '../store/uiStore';

// ── store category tabs (match backend `category` + a few reserved for growth)
const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'identity', label: 'Name Glows' },
  { key: 'themes',   label: 'Profile Nebulae' },
];

const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'rarity',   label: 'Rarity ↑' },
  { key: 'price_lo', label: 'Price ↑' },
  { key: 'price_hi', label: 'Price ↓' },
];

// A weekly "featured" reset gives the countdown something real to tick toward.
// Next Monday 00:00 local — computed at render (Date is fine in app runtime).
function nextReset() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const add = ((8 - d.getDay()) % 7) || 7; // days until next Monday (1..7)
  d.setDate(d.getDate() + add);
  return d;
}

function useCountdown(target) {
  const [left, setLeft] = useState(() => target - new Date());
  useEffect(() => {
    const id = setInterval(() => setLeft(target - new Date()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const clamp = Math.max(0, left);
  const s = Math.floor(clamp / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

function Preview({ item }) {
  const meta = COSMETIC_RENDER[item.key] || {};
  if (item.type === 'name_glow') return <span className={meta.glowClass} style={{ fontSize: 22 }}>Aa</span>;
  if (item.type === 'background' && meta.swatch)
    return <span className="inline-block w-12 h-12 rounded-lg" style={{ background: meta.swatch }} />;
  return <ItemIcon item={item} size={44} color={rarityOf(item.rarity).color} />;
}

function RarityBadge({ rkey }) {
  const r = rarityOf(rkey);
  return <span className="rar-badge" style={rarityVars(rkey)}>{r.label}</span>;
}

function StoreCard({ item, onBuy, onEquip, busy }) {
  const r = rarityOf(item.rarity);
  const glow = cardGlowClass(item.rarity);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      style={rarityVars(item.rarity)}
      className={`group relative flex flex-col gap-3 rounded-2xl border border-white/10 p-4 backdrop-blur-md ${glow}`}
    >
      {/* card body glass */}
      <div className="absolute inset-0 rounded-2xl -z-10" style={{ background: 'rgba(18,20,33,.75)' }} />

      <div className="flex items-start justify-between gap-2">
        <RarityBadge rkey={item.rarity} />
        {item.equipped && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            <Check size={11} /> Equipped
          </span>
        )}
        {!item.equipped && item.owned && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-300">Owned</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl"
          style={{ background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.06), rgba(3,5,12,.7))', boxShadow: `inset 0 0 0 1px ${r.color}33` }}
        >
          <Preview item={item} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold text-white">{item.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">{item.hint}</div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        {!item.owned ? (
          <button
            onClick={() => onBuy(item.key)}
            disabled={busy || !item.affordable}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition
              ${item.affordable
                ? 'text-slate-900 hover:brightness-110'
                : 'cursor-not-allowed bg-white/5 text-slate-500'}`}
            style={item.affordable ? { background: 'linear-gradient(90deg,#38bdf8,#8b5cf6,#ec4899)' } : undefined}
          >
            {item.affordable ? <PhotonIcon size={13} animated={false} /> : <Lock size={12} />}
            {item.cost.toLocaleString()}
          </button>
        ) : item.equipped ? (
          <button
            onClick={() => onEquip(item.type, null)}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30"
          >
            <Check size={13} /> Unequip
          </button>
        ) : (
          <button
            onClick={() => onEquip(item.type, item.key)}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
          >
            Equip
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function Shop() {
  const { data, isLoading } = useShop();
  const buy = useBuyCosmetic();
  const equip = useEquipCosmetic();
  const { addToast } = useUIStore();

  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('featured');
  const reset = useMemo(() => nextReset(), []);
  const cd = useCountdown(reset);

  const onBuy = (key) => buy.mutate(key, {
    onSuccess: (d) => addToast(`Purchased — ${d.spentPhotons ?? d.spent} Photons spent ✨`, 'success'),
    onError: (e) => addToast(e.response?.data?.message || 'Purchase failed', 'error'),
  });
  const onEquip = (type, key) => equip.mutate({ type, key }, {
    onSuccess: () => addToast(key ? 'Equipped' : 'Unequipped', 'info'),
    onError: (e) => addToast(e.response?.data?.message || 'Could not equip', 'error'),
  });

  const catalog = useMemo(() => data?.catalog || [], [data]);
  const busy = buy.isPending || equip.isPending;

  const items = useMemo(() => {
    let list = catalog.filter((c) => tab === 'all' || (c.category || c.type) === tab);
    const rank = (c) => rarityOf(c.rarity).order;
    if (sort === 'rarity') list = [...list].sort((a, b) => rank(a) - rank(b));
    else if (sort === 'price_lo') list = [...list].sort((a, b) => a.cost - b.cost);
    else if (sort === 'price_hi') list = [...list].sort((a, b) => b.cost - a.cost);
    else list = [...list].sort((a, b) => rank(b) - rank(a)); // featured = rarest first
    return list;
  }, [catalog, tab, sort]);

  // Featured = the single rarest item the viewer doesn't own yet (or rarest overall).
  const featured = useMemo(() => {
    if (!catalog.length) return null;
    const pool = catalog.filter((c) => !c.owned);
    const src = pool.length ? pool : catalog;
    return [...src].sort((a, b) => rarityOf(b.rarity).order - rarityOf(a.rarity).order)[0];
  }, [catalog]);

  return (
    <div className="relative min-h-screen">
      {/* ── field: near-black with three radial nebula glows ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 15% 12%, rgba(56,189,248,.14), transparent 60%),' +
            'radial-gradient(55% 55% at 85% 20%, rgba(139,92,246,.16), transparent 62%),' +
            'radial-gradient(70% 60% at 50% 100%, rgba(236,72,153,.12), transparent 60%),' +
            '#07080f',
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* ── header ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <PhotonIcon size={26} />
            <h1
              className="text-2xl font-black tracking-tight sm:text-3xl"
              style={{ background: 'linear-gradient(90deg,#38bdf8,#8b5cf6,#ec4899)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
            >
              Nebula Store
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/holobay"
              className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-200 ring-1 ring-cyan-400/40 hover:bg-cyan-400/20"
              title="Try any look on a live hologram before you buy"
            >
              <FlaskConical size={14} /> Holo-Bay
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-violet-400/40 backdrop-blur"
                 style={{ boxShadow: '0 0 16px rgba(139,92,246,.25)' }}>
              <PhotonIcon size={16} />
              <span className="text-sm font-black tabular-nums text-violet-100">
                {(data?.photons ?? data?.stardust ?? 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Photons</span>
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-slate-400">
          Spend your Photons on glows, nebulae and effects. Equipped looks are visible to everyone across Orbit.
        </p>

        {/* ── featured rail with live countdown ── */}
        {featured && (
          <div className="rar-featured-sheen mt-5 overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5"
               style={{ ...rarityVars(featured.rarity), background: 'linear-gradient(120deg, rgba(56,189,248,.10), rgba(139,92,246,.12) 45%, rgba(236,72,153,.10))' }}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-black/30 rar-card-glow" style={rarityVars(featured.rarity)}>
                <Preview item={featured} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                    <SparkIcon size={12} /> Featured
                  </span>
                  <RarityBadge rkey={featured.rarity} />
                </div>
                <div className="mt-1 truncate text-lg font-black text-white">{featured.name}</div>
                <div className="truncate text-xs text-slate-300">{featured.hint}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1 tabular-nums">
                  {[['d', cd.d], ['h', cd.h], ['m', cd.m], ['s', cd.s]].map(([u, v]) => (
                    <span key={u} className="rounded-md bg-black/40 px-2 py-1 text-center">
                      <span className="block text-sm font-black text-white">{String(v).padStart(2, '0')}</span>
                      <span className="block text-[9px] uppercase text-slate-400">{u}</span>
                    </span>
                  ))}
                </div>
                {!featured.owned && (
                  <button
                    onClick={() => onBuy(featured.key)}
                    disabled={busy || !featured.affordable}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black ${featured.affordable ? 'text-slate-900' : 'cursor-not-allowed bg-white/5 text-slate-500'}`}
                    style={featured.affordable ? { background: 'linear-gradient(90deg,#38bdf8,#8b5cf6,#ec4899)' } : undefined}
                  >
                    {featured.affordable ? <PhotonIcon size={13} animated={false} /> : <Lock size={12} />}
                    {featured.cost.toLocaleString()}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── tabs + sort ── */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === t.key ? 'bg-white/15 text-white ring-1 ring-white/25' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="ml-auto rounded-full border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* ── grid: 4 → 3 → 2 → 1 ── */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">Loading the store…</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-slate-500">Nothing here yet — check another tab.</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((it) => (
              <StoreCard key={it.key} item={it} onBuy={onBuy} onEquip={onEquip} busy={busy} />
            ))}
          </div>
        )}

        {/* ── rarity legend (live tiers highlighted) ── */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Rarity Ladder — 15 Cosmic Tiers</div>
          <div className="flex flex-wrap gap-2">
            {RARITY_ORDER.map((r) => {
              const live = LIVE_TIERS.includes(r.key);
              return (
                <span
                  key={r.key}
                  title={`${r.label}${live ? '' : ' (coming soon)'} — ${r.blurb}`}
                  className="rar-badge"
                  style={{ ...rarityVars(r.key), opacity: live ? 1 : 0.4 }}
                >
                  {r.label}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Glow intensity rises with rarity. Five tiers are live today; the rest unlock as the store grows.
          </p>
        </div>
      </div>
    </div>
  );
}
