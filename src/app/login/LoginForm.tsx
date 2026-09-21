'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/brand';

type Side = 'firm' | 'client';
type Step = 'email' | 'password' | 'verify' | 'welcome';

const DEMO: Record<Side, { label: string; email: string; role: string }[]> = {
  firm: [
    { label: 'Hundaol Girma', email: 'hundaol@siinqee-ib.demo', role: 'Managing Director' },
    { label: 'Meron Tadesse', email: 'meron@siinqee-ib.demo', role: 'Transaction Advisor' },
    { label: 'Dawit Bekele', email: 'dawit@siinqee-ib.demo', role: 'Analyst' },
  ],
  client: [
    { label: 'Tigist Alemu', email: 'finance@abyssiniaagro.et', role: 'Abyssinia Agro · CFO' },
    { label: 'Yohannes Girma', email: 'yohannes@lalibelacement.et', role: 'Lalibela Cement · FD' },
  ],
};

const CHECKS: Record<Side, string[]> = {
  firm: ['Credentials verified', 'Firm workspace & role loaded', 'Agent queue and review inbox synced', 'Opening dashboard'],
  client: ['Credentials verified', 'Engagement scope isolated to your company', 'Shared findings & document checklist loaded', 'Opening your portal'],
};

export default function LoginForm() {
  const router = useRouter();
  const [side, setSide] = useState<Side>('firm');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [who, setWho] = useState<{ name: string; redirect: string } | null>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (step === 'password' ? pwRef : emailRef).current?.focus(); }, [step, side]);

  function switchSide(s: Side) {
    if (busy || step === 'verify' || step === 'welcome') return;
    setSide(s); setStep('email'); setError(null); setEmail(''); setPassword('');
  }

  function nextFromEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid email address.'); return; }
    setStep('password');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, side }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Sign-in failed');
        setBusy(false);
        return;
      }
      setWho({ name: json.user?.name ?? '', redirect: json.redirect });
      setStep('verify');
      router.prefetch(json.redirect);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const gap = reduced ? 60 : 420;
      for (let i = 1; i <= CHECKS[side].length; i++) {
        await new Promise((r) => setTimeout(r, gap));
        setDone(i);
      }
      setStep('welcome');
      await new Promise((r) => setTimeout(r, reduced ? 150 : 900));
      router.replace(json.redirect);
      router.refresh();
    } catch {
      setError('Network error — try again.');
      setBusy(false);
    }
  }

  const stepIndex = ['email', 'password', 'verify', 'welcome'].indexOf(step);

  return (
    <div className="panel" style={{ padding: 26, width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-lg)' }}>
      <div className="side-toggle" role="tablist" aria-label="Sign-in side" style={{ marginBottom: 20 }}>
        <span className="thumb" style={{ transform: side === 'client' ? 'translateX(100%)' : 'none' }} aria-hidden />
        <button role="tab" aria-selected={side === 'firm'} type="button" onClick={() => switchSide('firm')}>Bank staff</button>
        <button role="tab" aria-selected={side === 'client'} type="button" onClick={() => switchSide('client')}>Client</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="steps-dots" aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} className={i <= stepIndex ? 'on' : ''} />)}</div>
        <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Step {Math.min(stepIndex + 1, 4)} of 4</span>
      </div>

      {step === 'email' && (
        <form key={`e-${side}`} className="step-in" onSubmit={nextFromEmail} style={{ display: 'grid', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 3px' }}>
              {side === 'firm' ? `Sign in — ${BRAND.name}` : 'Sign in to your client portal'}
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: 0 }}>
              {side === 'firm' ? 'Investment banking and transaction advisory staff.' : 'See your progress, missing documents and shared findings.'}
            </p>
          </div>
          <div className="field">
            <label className="label" htmlFor="email">Work email</label>
            <input ref={emailRef} id="email" className="input" type="email" autoComplete="username" required
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder={side === 'firm' ? 'you@siinqee-ib.demo' : 'you@company.et'} />
          </div>
          {error ? <Alert text={error} /> : null}
          <button className="btn btn-primary btn-lg" type="submit">Continue →</button>
          <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Demo accounts · password <span className="mono">demo1234</span></div>
            <div style={{ display: 'grid', gap: 5 }}>
              {DEMO[side].map((d) => (
                <button key={d.email} type="button" className="btn btn-sm lift"
                  style={{ justifyContent: 'space-between', width: '100%', height: 32 }}
                  onClick={() => { setEmail(d.email); setPassword('demo1234'); setError(null); setStep('password'); }}>
                  <span>{d.label}</span>
                  <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{d.role}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form key="p" className="step-in" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <button type="button" onClick={() => { setStep('email'); setError(null); }} className="chip-user"
            style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--hairline)', background: 'var(--surface-2)', borderRadius: 99, padding: '5px 12px 5px 5px', cursor: 'pointer', justifySelf: 'start', color: 'var(--ink)' }}>
            <span style={{ width: 26, height: 26, borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>
              {email.slice(0, 1).toUpperCase()}
            </span>
            <span style={{ fontSize: 12.5 }}>{email}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>change</span>
          </button>
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input ref={pwRef} id="password" className="input" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? <Alert text={error} action={/Switch to/.test(error) ? () => switchSideKeep(side === 'firm' ? 'client' : 'firm') : undefined} /> : null}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
        </form>
      )}

      {(step === 'verify' || step === 'welcome') && (
        <div key="v" className="step-in" style={{ display: 'grid', gap: 14 }} aria-live="polite">
          {step === 'welcome' ? (
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              <div className="welcome-badge" aria-hidden>✓</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', margin: '12px 0 4px' }}>
                Welcome{who?.name ? `, ${who.name.split(' ')[0]}` : ''}
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: 0 }}>
                {side === 'firm' ? 'Taking you to the bank dashboard…' : 'Taking you to your portal…'}
              </p>
            </div>
          ) : (
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Securing your session</h2>
          )}
          <ul className="verify" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {CHECKS[side].map((c, i) => (
              <li key={c} className={i < done ? 'done' : i === done ? 'run' : ''}>
                <span className="tick">{i < done ? '✓' : ''}</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  function switchSideKeep(s: Side) {
    setSide(s); setError(null); setStep('password');
  }
}

function Alert({ text, action }: { text: string; action?: () => void }) {
  return (
    <div role="alert" className="shake" style={{ fontSize: 12.5, color: 'var(--critical)', background: 'var(--critical-soft)', padding: '8px 10px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
      <span>{text}</span>
      {action ? <button type="button" className="btn btn-sm" onClick={action}>Switch</button> : null}
    </div>
  );
}
