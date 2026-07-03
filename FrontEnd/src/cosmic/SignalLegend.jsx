/**
 * SignalLegend — "Your Progress" explainer (Part 6, signal clarity).
 *
 * Three separate progression signals now coexist and are easy to confuse:
 *   • Stardust    — spendable soft currency (cosmetics only)
 *   • CosmicScore — long-term, all-time standing
 *   • Orbit XP    — this week's league race (resets Monday)
 * This surface gives each a DISTINCT icon + color + one-line "what is this?" so
 * users can tell them apart at a glance. Rendered once on the /orbit hub.
 */
import { Sparkles, Orbit as OrbitIcon, Zap } from 'lucide-react';

const SIGNALS = [
  {
    key: 'stardust',
    Icon: Sparkles,
    color: '#c4b5fd',                 // violet
    label: 'Stardust',
    what: 'Spend on looks — name glows & nebula backgrounds. Never buys ranking.',
  },
  {
    key: 'cosmic',
    Icon: OrbitIcon,
    color: '#38bdf8',                 // sky
    label: 'CosmicScore',
    what: 'Your all-time standing, earned from real reviews. Moves slowly.',
  },
  {
    key: 'xp',
    Icon: Zap,
    color: '#fbbf24',                 // amber
    label: 'Orbit XP',
    what: "This week's league race. Resets every Monday.",
  },
];

export default function SignalLegend() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
      <h2 className="text-sm font-bold text-white mb-3">Your progress — three signals</h2>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {SIGNALS.map(({ key, Icon, color, label, what }) => (
          <div key={key} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={15} style={{ color }} />
              <span className="text-sm font-bold" style={{ color }}>{label}</span>
            </div>
            <p className="text-[11px] leading-snug text-slate-400">{what}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
