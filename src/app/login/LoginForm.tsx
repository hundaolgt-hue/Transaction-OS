'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const DEMO = [
  { label: 'Managing Partner', email: 'hundaol@raphaconsult.et', role: 'Full access' },
  { label: 'Transaction Advisor', email: 'meron@raphaconsult.et', role: 'Deal team' },
  { label: 'Analyst', email: 'dawit@raphaconsult.et', role: 'Review only' },
  { label: 'Client (Abyssinia Agro)', email: 'finance@abyssiniaagro.et', role: 'Client portal' },
];

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('hundaol@raphaconsult.et');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Sign-in failed');
      return;
    }
    start(() => {
      router.replace(json.redirect);
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: 24, boxShadow: 'var(--shadow-lg)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 3px' }}>Sign in</h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '0 0 18px' }}>Use your firm or client-portal credentials.</p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? (
          <div role="alert" style={{ fontSize: 12.5, color: 'var(--critical)', background: 'var(--critical-soft)', border: '1px solid var(--critical-soft)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        ) : null}
        <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
        <div className="eyebrow" style={{ marginBottom: 9 }}>Demo accounts · password <span className="mono">demo1234</span></div>
        <div style={{ display: 'grid', gap: 5 }}>
          {DEMO.map((d) => (
            <button key={d.email} type="button" className="btn btn-sm"
              style={{ justifyContent: 'space-between', width: '100%', height: 30 }}
              onClick={() => { setEmail(d.email); setPassword('demo1234'); }}>
              <span>{d.label}</span>
              <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{d.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
