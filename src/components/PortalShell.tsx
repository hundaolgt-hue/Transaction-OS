'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import Motion from './Motion';
import AssistantDock from './AssistantDock';
import type { Session } from '@/lib/types';

export default function PortalShell({ session, advisorName, logo, unread, children }: {
  session: Session; advisorName: string; logo?: string | null; unread: number; children: React.ReactNode;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') ?? 'dark');
  }, []);

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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="brand-bar" aria-hidden />
      <header className="portal-topbar">
        <Link href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BrandMark logo={logo} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em' }}>{advisorName}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Client portal · Advisor OS</div>
          </div>
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-subtle)' }} className="portal-name">{session.name}</span>
        <NotificationBell initialUnread={unread} />
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle colour theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button className="btn btn-sm" onClick={signOut}>Sign out</button>
      </header>

      <main className="portal-content">{children}</main>

      <Motion />
      <AssistantDock audience="client" />
      <footer style={{ borderTop: '1px solid var(--hairline)', padding: '14px 16px', textAlign: 'center', fontSize: 11.5, color: 'var(--ink-faint)' }}>
        This portal shows the progress of your transaction. Internal review notes and draft reports are not shown here
        until {advisorName} releases them.
      </footer>


    </div>
  );
}
