'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import Motion from './Motion';
import AssistantDock from './AssistantDock';
import type { Session } from '@/lib/types';

export default function PortalShell({ session, advisorName, unread, children }: {
  session: Session; advisorName: string; unread: number; children: React.ReactNode;
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
      <header className="portal-topbar">
        <Link href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <path d="M9 22V10h5.2c2.6 0 4.3 1.5 4.3 3.8 0 1.7-.9 2.9-2.4 3.4L23 22h-3.4l-3.4-4.4h-2V22H9Zm5-6.8c1.2 0 1.9-.6 1.9-1.6s-.7-1.5-1.9-1.5h-1.8v3.1H14Z" fill="var(--accent-ink)" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em' }}>{advisorName}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Client portal</div>
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
