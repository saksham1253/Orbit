/**
 * LanguageMultiSelect — one shared searchable multi-select for spoken languages
 * (v6 §1). Used by both signup (Register) and the profile editor (Profile) so
 * there is a single source of truth. Submits/stores the language NAME string,
 * matching the existing `languages: [String]` contract (no migration).
 *
 * Features: typeahead filter (name + native), removable chips, "N/max" counter,
 * min-1 + configurable max cap, full combobox a11y (arrow/Enter/Esc), and a
 * windowed dropdown so 120+ options scroll smoothly with no extra dependency.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, Search, Globe } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import LANGUAGES from '../../data/languages';

const ROW_H = 40;        // px per option row
const VIEWPORT_H = 240;  // dropdown scroll height
const OVERSCAN = 4;      // extra rows above/below the viewport

export default function LanguageMultiSelect({
  value = [],
  onChange,
  maxSelections = 5,
  minSelections = 1,
  id = 'language-multiselect',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 120);
  const [activeIdx, setActiveIdx] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const atMax = value.length >= maxSelections;

  // Filter by name or native (case-insensitive). Empty query → full list.
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.native && l.native.toLowerCase().includes(q))
    );
  }, [debouncedQuery]);

  // Clamp the active option into range whenever the filtered set shrinks
  // (derived during render — no setState-in-effect).
  const safeActiveIdx = filtered.length ? Math.min(activeIdx, filtered.length - 1) : 0;

  // Reset highlight + scroll when the search query changes.
  const onQueryChange = (next) => {
    setQuery(next);
    setActiveIdx(0);
    setScrollTop(0);
    if (listRef.current) listRef.current.scrollTop = 0;
    setOpen(true);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const isSelected = (name) => value.includes(name);

  const toggle = (name) => {
    if (isSelected(name)) {
      if (value.length > minSelections) onChange(value.filter((l) => l !== name));
    } else if (value.length < maxSelections) {
      onChange([...value, name]);
    }
  };

  const removeChip = (name) => {
    if (value.length > minSelections) onChange(value.filter((l) => l !== name));
  };

  // Ensure the active row is visible within the windowed viewport.
  const ensureVisible = (idx) => {
    const top = idx * ROW_H;
    const bottom = top + ROW_H;
    const el = listRef.current;
    if (!el) return;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + VIEWPORT_H) el.scrollTop = bottom - VIEWPORT_H;
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIdx((i) => { const n = Math.min(i + 1, filtered.length - 1); ensureVisible(n); return n; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => { const n = Math.max(i - 1, 0); ensureVisible(n); return n; });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[safeActiveIdx]) toggle(filtered[safeActiveIdx].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Windowed slice — only render visible rows + overscan.
  const total = filtered.length;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(total, Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN);
  const visible = filtered.slice(startIdx, endIdx);

  return (
    <div ref={rootRef} className="relative">
      {/* Selected chips + counter */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-1) 40%, transparent)',
              color: 'var(--accent-1)',
            }}
          >
            {name}
            <button
              type="button"
              onClick={() => removeChip(name)}
              disabled={value.length <= minSelections}
              aria-label={`Remove ${name}`}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <span className="text-xs text-text-muted ml-auto tabular-nums">
          {value.length}/{maxSelections} selected
        </span>
      </div>

      {/* Combobox input */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && filtered[safeActiveIdx] ? `${id}-opt-${safeActiveIdx}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={atMax ? `Max ${maxSelections} reached — remove one to change` : 'Search 120+ languages…'}
          onFocus={() => setOpen(true)}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="input-glass w-full pl-10 pr-4 py-3 text-sm text-text-primary min-h-[44px]"
        />
      </div>

      {/* Dropdown listbox (windowed) */}
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label="Languages"
          ref={listRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="absolute z-50 mt-1.5 w-full overflow-y-auto rounded-xl shadow-2xl"
          style={{
            maxHeight: VIEWPORT_H,
            background: 'var(--color-background)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {total === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-text-muted">
              No language found — try another spelling.
            </div>
          ) : (
            <div style={{ height: total * ROW_H, position: 'relative' }}>
              {visible.map((lang, i) => {
                const idx = startIdx + i;
                const selected = isSelected(lang.name);
                const active = idx === safeActiveIdx;
                const disabled = !selected && atMax;
                return (
                  <button
                    key={lang.name}
                    id={`${id}-opt-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => toggle(lang.name)}
                    className="absolute left-0 right-0 flex items-center gap-2.5 px-3.5 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      top: idx * ROW_H,
                      height: ROW_H,
                      background: active ? 'color-mix(in srgb, var(--accent-1) 12%, transparent)' : 'transparent',
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded flex-none"
                      style={{
                        border: selected ? 'none' : '1px solid var(--border-subtle)',
                        background: selected ? 'var(--accent-1)' : 'transparent',
                      }}
                    >
                      {selected && <Check size={11} strokeWidth={3} color="var(--text-on-accent)" />}
                    </span>
                    <span className="text-text-primary truncate">{lang.name}</span>
                    {lang.native && lang.native !== lang.name && (
                      <span className="text-text-muted text-xs truncate ml-auto">{lang.native}</span>
                    )}
                    {lang.common && (
                      <Globe size={11} className="text-accent/60 flex-none" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
