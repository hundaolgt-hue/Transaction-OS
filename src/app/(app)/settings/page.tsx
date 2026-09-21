import { requireStaff, listOrgUsers } from '@/lib/auth';
import { getOrg, listClients } from '@/lib/repo/core';
import { env } from '@/lib/env';
import { readOutbox } from '@/lib/notify';
import { Panel, PanelHead, Chip, Defs, Empty, Avatar } from '@/components/ui';
import { ROLE_LABEL, relTime, type Role } from '@/lib/domain';
import UserManager from '@/components/UserManager';
import IntegrationsPanel from '@/components/IntegrationsPanel';
import BrandMark from '@/components/BrandMark';
import { BRAND } from '@/lib/brand';
import { publicView } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireStaff();
  const org = getOrg(session.orgId);
  const users = listOrgUsers(session.orgId);
  const clients = listClients(session.orgId);
  const channels = publicView(session.orgId) as Parameters<typeof IntegrationsPanel>[0]['initial'];
  const outbox = env.mailEnabled ? [] : readOutbox().slice(0, 12);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow">Configuration</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Settings</h1>
      </header>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="Firm" />
          <div className="panel-body">
            <Defs items={[
              ['Name', org?.name ?? '—'],
              ['Legal name', org?.legalName ?? '—'],
              ['ECMA licence', org?.licenseNo ?? '—'],
              ['TIN', org?.tin ?? '—'],
              ['Address', [org?.addressLine, org?.city, org?.country].filter(Boolean).join(', ') || '—'],
              ['Email', org?.email ?? '—'],
              ['Phone', org?.phone ?? '—'],
              ['Clients', String(clients.length)],
            ]} />
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Brand" sub={`${BRAND.name} · configured in src/lib/brand.ts`} />
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BrandMark variant="lockup" size={44} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{BRAND.legalName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{BRAND.group}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {([['Royal blue', BRAND.colors.blue], ['Bright blue', BRAND.colors.blueBright], ['Yellow', BRAND.colors.yellow], ['Blue on dark', BRAND.colors.blueOnDark]] as const).map(([label, hex]) => (
                <div key={hex} style={{ display: 'grid', gap: 4, fontSize: 11.5 }}>
                  <span style={{ width: 64, height: 36, borderRadius: 8, background: hex, border: '1px solid var(--hairline)' }} />
                  <span>{label}</span><span className="mono" style={{ color: 'var(--ink-faint)' }}>{hex}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: 0, lineHeight: 1.55 }}>
              {'Official logo files are in public/brand/ (light and dark lock-ups plus the symbol).'}
              {' '}Licence number, TIN and contact details are intentionally blank until the bank's official values are entered.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Integrations" sub="Read from the environment at boot" />
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            <IntegrationRow
              name="Anthropic reasoning engine"
              on={env.aiEnabled}
              detail={env.aiEnabled
                ? `Active — ${env.anthropicModel}. Agents add a reasoning pass on top of the rule engine.`
                : 'Not configured. Agents run the deterministic rule engine only; everything still works, with less nuance in the drafts. Set ANTHROPIC_API_KEY to enable.'}
            />
            <IntegrationRow
              name="Email delivery (SMTP)"
              on={env.mailEnabled}
              detail={env.mailEnabled
                ? `Sending through ${env.smtpHost}:${env.smtpPort} as ${env.mailFrom}.`
                : 'Not configured. Notification emails are written to an in-memory outbox below instead of being sent. Set SMTP_HOST to enable.'}
            />
            <IntegrationRow
              name="Document text extraction"
              on
              detail="PDF, DOCX and plain-text uploads are mined for text so the agents can reason over them. Scanned images need OCR before upload."
            />
          </div>
        </Panel>
      </div>

      <section style={{ display: 'grid', gap: 10 }}>
        <div>
          <div className="eyebrow">Messaging</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '2px 0 0' }}>Telegram &amp; Slack</h2>
        </div>
        <IntegrationsPanel initial={channels} canManage={session.role === 'OWNER'} />
      </section>

      <UserManager
        users={users.map((u) => ({
          id: u.id, name: u.name, email: u.email, role: u.role, title: u.title,
          clientId: u.clientId, lastLoginAt: u.lastLoginAt, avatarColor: u.avatarColor,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        canManage={session.role === 'OWNER'}
      />

      {!env.mailEnabled ? (
        <Panel>
          <PanelHead title="Email outbox" sub="Where notification emails go while SMTP is unconfigured" />
          {outbox.length === 0 ? <Empty title="Nothing sent yet" /> : (
            <div>
              {outbox.map((m, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: i === outbox.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.subject}</span>
                    <span className="mono" style={{ color: 'var(--ink-faint)' }}>→ {m.to}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 'auto' }}>{relTime(m.at)}</span>
                  </div>
                  <pre style={{ fontSize: 11.5, color: 'var(--ink-subtle)', margin: '6px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                    {m.text.slice(0, 400)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function IntegrationRow({ name, on, detail }: { name: string; on: boolean; detail: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: on ? 'var(--good)' : 'var(--high)', marginTop: 6, flex: 'none' }} />
      <div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
          <Chip tone={on ? 'good' : 'medium'}>{on ? 'Active' : 'Not configured'}</Chip>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '3px 0 0', lineHeight: 1.55 }}>{detail}</p>
      </div>
    </div>
  );
}
