/**
 * useToast — minimal toast for the Command Center (the audit noted there's no
 * shared feedback component; pages used ad-hoc inline msg/err state). Returns a
 * `push(message, type)` and a `<Toasts/>` element to render. Auto-dismisses.
 */
import { useCallback, useRef, useState } from 'react';

let _id = 0;

export default function useToast() {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((message, type = 'info') => {
    const id = ++_id;
    setItems((list) => [...list, { id, message, type }]);
    timers.current[id] = setTimeout(() => remove(id), 3600);
  }, [remove]);

  const color = (t) => (t === 'error' ? 'var(--ss-danger, #ff4b4b)' : t === 'success' ? 'var(--ss-ok, #22c55e)' : 'var(--ss-accent, #00c6ff)');

  const Toasts = (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className="ssctl-card"
          style={{ padding: '10px 14px', borderLeft: `3px solid ${color(t.type)}`, fontSize: 13, cursor: 'pointer', maxWidth: 340 }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );

  return { push, Toasts };
}
