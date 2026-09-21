'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Note {
  id: string; kind: string; severity: string; title: string; body: string;
  link: string | null; readAt: string | null; createdAt: string;
}

const TONE: Record<string, string> = { CRITICAL: 'var(--critical)', WARNING: 'var(--high)', INFO: 'var(--ink-subtle)' };

export default function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Poll for new notifications; cheap and robust behind any proxy.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/notifications?countOnly=1');
        if (r.ok) setUnread((await r.json()).unread ?? 0);
      } catch { /* offline */ }
    }, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const r = await fetch('/api/notifications');
        const j = await r.json();
        setItems(j.notifications ?? []);
        setUnread(j.unread ?? 0);
      } finally { setLoading(false); }
    }
  }

  async function markAll() {
    await fetch('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ all: true }) });
    setUnread(0);
    setItems((v) => v.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, padding: '0 4px',
            borderRadius: 99, background: 'var(--critical)', color: '#fff',
            fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 99 ? '99+' : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="panel fade-up" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 'min(380px, calc(100vw - 32px))',
          zIndex: 50, boxShadow: 'var(--shadow-lg)', maxHeight: 460, display: 'flex', flexDirection: 'column',
        }}>
          <div className="panel-head" style={{ padding: '10px 12px' }}>
            <span className="panel-title">Notifications</span>
            {unread > 0 ? <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button> : null}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 14, display: 'grid', gap: 8 }}>
                {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 40 }} />)}
              </div>
            ) : items.length === 0 ? (
              <div className="empty"><div className="empty-title">Nothing yet</div><div className="empty-body">Agent runs, document alerts and milestone changes appear here.</div></div>
            ) : (
              items.map((n) => {
                const inner = (
                  <>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: TONE[n.severity] ?? 'var(--ink-faint)', flex: 'none', marginTop: 5 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: n.readAt ? 450 : 600, color: 'var(--ink)' }}>{n.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap' }}>
                          {n.body.length > 190 ? `${n.body.slice(0, 190)}…` : n.body}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}
                    style={{ display: 'block', padding: '10px 12px', borderBottom: '1px solid var(--hairline)', background: n.readAt ? 'transparent' : 'var(--accent-soft)' }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)', background: n.readAt ? 'transparent' : 'var(--accent-soft)' }}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
