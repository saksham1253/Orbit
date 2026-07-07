/**
 * ShopPanel — the Photon Cosmetics Shop on the /orbit hub (Tier 3).
 *
 * The SPEND side of the Photon economy: buy name-glows and nebula profile
 * backgrounds, then equip/unequip them. Each card previews the cosmetic live
 * and reflects owned / equipped / affordable state. Purchases refresh the
 * Photons balance shown elsewhere on the page.
 */
import { Check, Lock } from 'lucide-react';
import PhotonIcon from './PhotonIcon';
import { useShop, useBuyCosmetic, useEquipCosmetic } from './useShop';
import { COSMETIC_RENDER } from './cosmetics';
import { useUIStore } from '../store/uiStore';

function Preview({ item }) {
  const meta = COSMETIC_RENDER[item.key] || {};
  if (item.type === 'name_glow') {
    return <span className={meta.glowClass} style={{ fontSize: 18 }}>Aa</span>;
  }
  return <span className="inline-block w-10 h-10 rounded-lg" style={{ background: meta.swatch }} />;
}

function CosmeticCard({ item, onBuy, onEquip, busy }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${item.equipped ? 'border-amber-400/50 bg-amber-400/5' : 'border-white/10 bg-slate-900/40'}`}>
      <div className="flex items-center gap-2">
        <div className="w-11 h-11 rounded-lg bg-slate-950/60 flex items-center justify-center shrink-0">
          <Preview item={item} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{item.name}</div>
          <div className="text-[11px] text-slate-400 truncate">{item.hint}</div>
        </div>
      </div>

      {!item.owned ? (
        <button
          onClick={() => onBuy(item.key)}
          disabled={busy || !item.affordable}
          className={`mt-auto inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition
            ${item.affordable
              ? 'bg-gradient-to-r from-amber-400 to-violet-500 text-slate-900 hover:brightness-110'
              : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
        >
          {item.affordable ? <PhotonIcon size={13} animated={false} /> : <Lock size={13} />} {item.cost}
        </button>
      ) : item.equipped ? (
        <button
          onClick={() => onEquip(item.type, null)}
          disabled={busy}
          className="mt-auto inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
        >
          <Check size={13} /> Equipped
        </button>
      ) : (
        <button
          onClick={() => onEquip(item.type, item.key)}
          disabled={busy}
          className="mt-auto rounded-full px-3 py-1.5 text-xs font-bold bg-white/10 text-white hover:bg-white/20"
        >
          Equip
        </button>
      )}
    </div>
  );
}

export default function ShopPanel() {
  const { data } = useShop();
  const buy = useBuyCosmetic();
  const equip = useEquipCosmetic();
  const { addToast } = useUIStore();
  if (!data) return null;

  const onBuy = (key) => buy.mutate(key, {
    onSuccess: (d) => addToast(`Purchased — ${d.spentPhotons ?? d.spent} Photons spent ✨`, 'success'),
    onError: (e) => addToast(e.response?.data?.message || 'Purchase failed', 'error'),
  });
  const onEquip = (type, key) => equip.mutate({ type, key }, {
    onSuccess: () => addToast(key ? 'Equipped' : 'Unequipped', 'info'),
    onError: (e) => addToast(e.response?.data?.message || 'Could not equip', 'error'),
  });

  const glows = data.catalog.filter((c) => c.type === 'name_glow');
  const backgrounds = data.catalog.filter((c) => c.type === 'background');
  const busy = buy.isPending || equip.isPending;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <PhotonIcon size={18} animated={false} />
        <h2 className="text-base font-bold text-white">Photon Shop</h2>
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-violet-200">
          <PhotonIcon size={14} /> {data.photons ?? data.stardust}
        </span>
      </div>

      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Name Glows</h3>
      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-4">
        {glows.map((c) => <CosmeticCard key={c.key} item={c} onBuy={onBuy} onEquip={onEquip} busy={busy} />)}
      </div>

      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Profile Nebulae</h3>
      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
        {backgrounds.map((c) => <CosmeticCard key={c.key} item={c} onBuy={onBuy} onEquip={onEquip} busy={busy} />)}
      </div>
    </section>
  );
}
