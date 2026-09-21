import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';
import LoginArt from './LoginArt';
import BrandMark from '@/components/BrandMark';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === 'CLIENT' ? '/portal' : '/dashboard');

  return (
    <main className="login-stage">
      <section className="login-art">
        <LoginArt />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark variant="lockup" size={84} on="dark" />
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
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, opacity: 0.6 }}>
          <span className="brand-chip" style={{ color: 'inherit' }}><i /><i />{BRAND.group}</span>
          <span>Demo client data is fictional. Regulatory references follow the ECMA rule pack.</span>
        </div>
      </section>
      <section className="login-pane"><LoginForm /></section>
    </main>
  );
}
