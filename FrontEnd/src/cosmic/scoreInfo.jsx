/**
 * scoreInfo.jsx — small reusable affordances for surfacing the score explainers
 * (deep-spec §4, §4.5): an accessible InfoDot tooltip, a Disclosure
 * (collapsible), and ScoreExplainerBody which renders a copy object from
 * scoreCopy.js. Display-layer only — never reads or recomputes any score logic.
 */
import { useEffect, useRef, useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';

/**
 * ScoreExplainerBody — renders an info object (what it is + how to raise it).
 * Used inside the Disclosure and the Observatory explainer.
 */
export function ScoreExplainerBody({ info }) {
  if (!info) return null;
  return (
    <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
      <p><span className="font-semibold text-text-primary">What it is: </span>{info.whatItIs}</p>
      {info.howToRaise?.length > 0 && (
        <div>
          <p className="font-semibold text-text-primary mb-1">How to raise it:</p>
          <ul className="list-disc pl-4 space-y-1">
            {info.howToRaise.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}
      {info.goodToKnow && (
        <p className="text-text-muted"><span className="font-semibold">Good to know: </span>{info.goodToKnow}</p>
      )}
    </div>
  );
}

/**
 * InfoDot — a small accessible "i" button that reveals a popover on
 * hover / focus / click, and closes on Escape, blur, or outside click.
 */
export function InfoDot({ label = 'More info', children, side = 'right', size = 13 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClickAway = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickAway);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickAway);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center rounded-full text-text-muted hover:text-accent focus:outline-none focus:text-accent transition-colors">
        <Info size={size} />
      </button>
      {open && (
        <span role="tooltip"
          className="absolute z-50 top-full mt-1.5 w-60 p-3 rounded-xl text-xs font-normal normal-case tracking-normal text-left text-text-secondary leading-relaxed shadow-xl"
          style={{
            background: 'var(--surface, #15102b)', border: '1px solid var(--border-subtle)',
            [side === 'right' ? 'left' : 'right']: 0,
          }}>
          {children}
        </span>
      )}
    </span>
  );
}

/**
 * Disclosure — collapsed-by-default expandable section (§4.5).
 */
export function Disclosure({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-text-primary text-left">
        <span>{title}</span>
        <ChevronDown size={14} className="flex-none transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}
