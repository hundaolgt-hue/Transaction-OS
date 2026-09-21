import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === 'CLIENT' ? '/portal' : '/dashboard');

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 940, display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px,100%), 1fr))', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Mark />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Advisor OS</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Ethiopian Transaction Advisory</div>
            </div>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.15, margin: '0 0 14px' }}>
            One workspace from mandate<br />to ECMA filing.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-subtle)', lineHeight: 1.65, margin: '0 0 22px', maxWidth: '46ch' }}>
            Track every client&apos;s document set against the ECMA checklist, let specialised agents draft the legal,
            financial and risk due diligence for your experts to review, and give the client a live view of what is
            still missing.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {[
              ['Document compliance engine', 'Weighted completeness against a versioned ECMA rule pack, with stage gates.'],
              ['Six specialised agents', 'Financial, Legal, Risk, Prospectus, Secretary and Project Management — human-in-the-loop by design.'],
              ['Shared client dashboard', 'The client sees progress, missing documents and milestones. Nothing internal leaks.'],
            ].map(([t, d]) => (
              <li key={t} style={{ display: 'flex', gap: 10 }}>
                <span style={{ width: 4, borderRadius: 99, background: 'var(--accent-line)', flex: 'none', marginTop: 3, marginBottom: 3 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.55 }}>{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 22V10h5.2c2.6 0 4.3 1.5 4.3 3.8 0 1.7-.9 2.9-2.4 3.4L23 22h-3.4l-3.4-4.4h-2V22H9Zm5-6.8c1.2 0 1.9-.6 1.9-1.6s-.7-1.5-1.9-1.5h-1.8v3.1H14Z" fill="var(--accent-ink)" />
    </svg>
  );
}
