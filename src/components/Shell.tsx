'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import { BRAND } from '@/lib/brand';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { Session } from '@/lib/types';
import NotificationBell from './NotificationBell';
import Motion from './Motion';
import AssistantDock from './AssistantDock';

interface EngSummary { id: string; reference: string; name: string; client: string; stage: string }

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/graph', label: 'Knowledge graph', icon: 'graph' },
  { href: '/assistant', label: 'Ask the OS', icon: 'chat' },
  { href: '/engagements', label: 'Engagements', icon: 'folder' },
  { href: '/clients', label: 'Clients', icon: 'users' },
  { href: '/agents', label: 'Agents', icon: 'cpu' },
  { href: '/rules', label: 'Rule packs', icon: 'book' },
  { href: '/audit', label: 'Audit trail', icon: 'shield' },
  { href: '/settings', label: 'Settings', icon: 'cog' },
];

export default function Shell({ session, orgName, logo, unread, engagements, children }: {
  session: Session; orgName: string; logo?: string | null; unread: number; engagements: EngSummary[]; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') ?? 'dark';
    setTheme(t);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('advisoros-theme', next); } catch { /* private mode */ }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="app-root">
      <aside className="app-sidebar" data-open={open ? 'true' : 'false'}>
        <div className="brand-bar" aria-hidden />
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--hairline)' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BrandMark logo={logo} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{BRAND.product} · {BRAND.descriptor.split(' · ')[0]}</div>
            </div>
          </Link>
        </div>

        <nav style={{ padding: 8, display: 'grid', gap: 1 }}>
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link key={n.href} href={n.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px',
                  borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: active ? 600 : 450,
                  color: active ? 'var(--ink)' : 'var(--ink-subtle)',
                  background: active ? 'var(--surface-3)' : 'transparent',
                }}>
                <Icon name={n.icon} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {engagements.length ? (
          <div style={{ padding: '8px 8px 0', marginTop: 4, borderTop: '1px solid var(--hairline)', overflowY: 'auto', flex: 1 }}>
            <div className="eyebrow" style={{ padding: '8px 9px 6px' }}>Active engagements</div>
            <div style={{ display: 'grid', gap: 1, paddingBottom: 8 }}>
              {engagements.map((e) => {
                const active = pathname.startsWith(`/engagements/${e.id}`);
                return (
                  <Link key={e.id} href={`/engagements/${e.id}`}
                    style={{
                      padding: '6px 9px', borderRadius: 'var(--radius-md)',
                      background: active ? 'var(--surface-3)' : 'transparent',
                    }}>
                    <div className="mono" style={{ color: active ? 'var(--accent)' : 'var(--ink-faint)', fontSize: 10.5 }}>{e.reference}</div>
                    <div style={{ fontSize: 12.5, color: active ? 'var(--ink)' : 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.client}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : <div style={{ flex: 1 }} />}

        <div style={{ padding: 10, borderTop: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flex: 'none',
          }}>
            {session.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{session.role.toLowerCase()}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out" aria-label="Sign out">
            <Icon name="exit" />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button className="btn btn-ghost btn-sm app-menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation">
            <Icon name="menu" />
          </button>
          <div style={{ flex: 1 }} />
          <NotificationBell initialUnread={unread} />
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle colour theme" title="Toggle colour theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </header>

        <main className="app-content">{children}</main>
      </div>

      {open ? <button aria-label="Close navigation" onClick={() => setOpen(false)} className="app-scrim" /> : null}
      <Motion />
      <AssistantDock audience="staff" />


    </div>
  );
}

function Icon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    graph: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="9" cy="18" r="2.5" /><path d="M8.3 7.2l7.4.6M7 8.3l1.4 7.3M16.6 10l-5.7 6.4" /></>,
    chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.9" /><path d="M17 14.2a6 6 0 0 1 4 5.8" /></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" /></>,
    shield: <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" />,
    cog: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
    exit: <><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" /></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
    moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden>
      {p[name]}
    </svg>
  );
}
