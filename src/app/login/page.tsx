import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';
import LoginArt from './LoginArt';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === 'CLIENT' ? '/portal' : '/dashboard');

  return (
    <main className="login-stage">
      <section className="login-art">
        <LoginArt />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mark />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Advisor OS</div>
            <div style={{ fontSize: 11.5, opacity: 0.7 }}>Ethiopian Transaction Advisory</div>
          </div>
        </div>
        <div style={{ maxWidth: 480 }}>
          <h1 className="login-title" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.12, margin: '0 0 14px' }}>
            One workspace from mandate to ECMA filing.
          </h1>
          <p style={{ fontSize: 14, opacity: 0.78, lineHeight: 1.65, margin: '0 0 22px' }}>
            Advisors run six specialised agents over the data room and review every draft. Clients see live progress,
            missing documents and the findings their advisor chose to share.
          </p>
          <div className="login-feats">
            {[
              ['Firm side', 'Engagements, agents, review inbox, 30+ page due diligence PDFs'],
              ['Client side', 'Checklist, uploads, milestones, shared findings only'],
              ['Connected', 'Email, Telegram and Slack alerts on compliance gaps'],
            ].map(([t, d], i) => (
              <div key={t} className="login-feat" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div>
                <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.55 }}>Demo data is fictional. Regulatory references are to ECMA directives as configured in the rule pack.</div>
      </section>
      <section className="login-pane"><LoginForm /></section>
    </main>
  );
}

function Mark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2fb57f" />
      <path d="M9 22V10h5.2c2.6 0 4.3 1.5 4.3 3.8 0 1.7-.9 2.9-2.4 3.4L23 22h-3.4l-3.4-4.4h-2V22H9Zm5-6.8c1.2 0 1.9-.6 1.9-1.6s-.7-1.5-1.9-1.5h-1.8v3.1H14Z" fill="#07140f" />
    </svg>
  );
}
