import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listEngagements, listClients, snapshot, listAudit, listStaff } from '@/lib/repo/core';
import { Panel, PanelHead, Stat, Meter, Chip, StatusChip, SeverityChip, Empty, Grid, Avatar } from '@/components/ui';
import { STAGE_META, TRANSACTION_LABEL, fmtMoney, fmtDate, relTime, titleCase, type Stage, type TransactionType } from '@/lib/domain';
import { getOrg } from '@/lib/repo/core';
import { buildGraph } from '@/lib/knowledge/graph';
import { stackedBars, donut, hbar, SCREEN_THEME, compact } from '@/lib/charts/svg';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import Chart from '@/components/Chart';
import { CountUp } from '@/components/Motion';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireStaff();
  const engagements = listEngagements(session.orgId);
  const clients = listClients(session.orgId);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const staff = listStaff(session.orgId);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const snaps = engagements
    .map((e) => snapshot(session.orgId, e.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const active = snaps.filter((s) => s.engagement.status === 'ACTIVE');
  const openFindings = snaps.reduce((a, s) => a + s.compliance.open, 0);
  const criticalFindings = snaps.reduce((a, s) => a + s.compliance.critical, 0);
  const avgCompleteness = active.length ? Math.round(active.reduce((a, s) => a + s.completeness.percent, 0) / active.length) : 0;
  const pipeline = active.reduce((a, s) => a + (s.engagement.targetRaise ?? 0), 0);
  const feesOutstanding = snaps.reduce((a, s) => a + s.fees.outstanding, 0);

  const attention = snaps
    .flatMap((s) => [
      ...s.gate.blockers.map((b) => ({ snap: s, kind: 'Stage gate', text: b, tone: 'high' as const })),
      ...(s.compliance.critical > 0 ? [{ snap: s, kind: 'Critical findings', text: `${s.compliance.critical} critical finding(s) open`, tone: 'critical' as const }] : []),
      ...s.milestones
        .filter((m) => m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate) < new Date())
        .map((m) => ({ snap: s, kind: 'Overdue milestone', text: `${m.name} was due ${fmtDate(m.dueDate)}`, tone: 'high' as const })),
    ])
    .slice(0, 8);

  const recent = listAudit(session.orgId, { limit: 12 });
  const graph = buildGraph(getOrg(session.orgId)!, staff, snaps);
  const stageCounts = Object.keys(STAGE_META).map((k) => ({
    stage: k as Stage,
    count: active.filter((s) => s.engagement.stage === k).length,
  }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow">Practice overview</div>
        <h1 style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.035em', margin: '3px 0 0' }}>
          Good {greeting()}, <span className="shine">{session.name.split(' ')[0]}</span>
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-subtle)', margin: '6px 0 0', maxWidth: '78ch', lineHeight: 1.6 }}>
          {active.length} active engagement{active.length === 1 ? '' : 's'} across {clients.length} client{clients.length === 1 ? '' : 's'}, worth {fmtMoney(pipeline)} in target raises.{' '}
          {criticalFindings ? <strong style={{ color: 'var(--critical)' }}>{criticalFindings} critical finding{criticalFindings === 1 ? ' needs' : 's need'} attention. </strong> : 'No critical findings are open. '}
          {attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'} are blocking progress.` : 'Nothing is blocked.'}
        </p>
      </header>

      <Grid min={185}>
        <Stat label="Active engagements" value={<CountUp value={active.length} />} sub={`${engagements.length - active.length} closed or paused`} />
        <Stat label="Pipeline value" value={fmtMoney(pipeline)} sub="Target raise across active mandates" />
        <Stat label="Avg. document completeness" value={<CountUp value={avgCompleteness} suffix="%" />}
          tone={avgCompleteness >= 75 ? 'good' : avgCompleteness >= 40 ? 'medium' : 'high'}
          sub="Weighted against the ECMA checklist" />
        <Stat label="Open findings" value={<CountUp value={openFindings} />}
          tone={criticalFindings > 0 ? 'critical' : openFindings > 0 ? 'medium' : 'good'}
          sub={`${criticalFindings} critical`} />
        <Stat label="Fees outstanding" value={fmtMoney(feesOutstanding)} sub="Invoiced, not yet received" />
      </Grid>

      <Panel className="reveal">
        <PanelHead title="Knowledge graph" sub="Every client, engagement, document, gap, finding, risk, person and agent — and how they connect"
          actions={<Link className="btn btn-sm" href="/graph">Full screen</Link>} />
        <div className="panel-body">
          <KnowledgeGraph graph={graph} height={460} compact />
        </div>
      </Panel>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}>
        <Panel className="reveal lift" data-delay="1">
          <PanelHead title="Open findings by engagement" sub="Severity mix" />
          <div className="panel-body">
            <Chart label="Stacked bars of open findings by severity for each engagement" svg={stackedBars({
              theme: SCREEN_THEME, width: 520,
              rows: active.map((s2) => ({ label: s2.engagement.reference, parts: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((k) => ({ key: k, value: s2.findings.filter((f) => f.severity === k && ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status)).length })) })),
              colors: { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' },
            })} />
          </div>
        </Panel>
        <Panel className="reveal lift" data-delay="2">
          <PanelHead title="Fee position" sub="Across all contracts" />
          <div className="panel-body">
            <Chart label="Donut of fees received, invoiced and unbilled" svg={donut({
              theme: SCREEN_THEME, width: 440, height: 180,
              items: [
                { label: 'Received', value: snaps.reduce((a, x) => a + x.fees.paid, 0), color: 'var(--good)' },
                { label: 'Invoiced, unpaid', value: snaps.reduce((a, x) => a + x.fees.outstanding, 0), color: 'var(--high)' },
                { label: 'Not yet billed', value: snaps.reduce((a, x) => a + x.fees.unbilled, 0), color: 'var(--low)' },
              ],
              centre: compact(snaps.reduce((a, x) => a + (x.contract?.totalFee ?? 0), 0)), sub: 'ETB contracted',
            })} />
          </div>
        </Panel>
        <Panel className="reveal lift" data-delay="3">
          <PanelHead title="Document completeness" sub="Weighted against each rule pack" />
          <div className="panel-body">
            <Chart label="Horizontal bars of document completeness per engagement" svg={hbar({
              theme: SCREEN_THEME, width: 520, max: 100, format: (v) => `${v}%`,
              items: active.map((s2) => ({ label: `${s2.engagement.reference} ${s2.client.name}`, value: s2.completeness.percent, color: s2.completeness.percent >= 75 ? 'var(--good)' : s2.completeness.percent >= 40 ? 'var(--high)' : 'var(--critical)' })),
            })} />
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))' }}>
        <Panel className="reveal">
          <PanelHead title="Engagements" sub="Health across the active book"
            actions={<Link className="btn btn-sm" href="/engagements">View all</Link>} />
          {active.length === 0 ? (
            <Empty title="No active engagements"
              body="Create a client and open an engagement to begin tracking documents against the ECMA checklist."
              action={<Link className="btn btn-primary btn-sm" href="/clients">Add a client</Link>} />
          ) : (
            <div className="table-scroll">
              <table className="data" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Engagement</th><th>Stage</th><th style={{ width: 140 }}>Documents</th>
                    <th className="num">Findings</th><th className="num">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((s) => (
                    <tr key={s.engagement.id}>
                      <td style={{ minWidth: 210 }}>
                        <Link href={`/engagements/${s.engagement.id}`} style={{ display: 'block' }}>
                          <div style={{ fontWeight: 500, lineHeight: 1.35 }}>{s.client.name}</div>
                          <div className="mono" style={{ color: 'var(--ink-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.engagement.reference} · {TRANSACTION_LABEL[s.engagement.transactionType as TransactionType] ?? s.engagement.transactionType}
                          </div>
                        </Link>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}><Chip tone="neutral">{STAGE_META[s.engagement.stage as Stage]?.label ?? titleCase(s.engagement.stage)}</Chip></td>
                      <td><Meter value={s.completeness.percent} /></td>
                      <td className="num">
                        {s.compliance.open === 0
                          ? <Chip tone="good">Clear</Chip>
                          : <Chip tone={s.compliance.critical ? 'critical' : s.compliance.high ? 'high' : 'medium'}>{s.compliance.open}</Chip>}
                      </td>
                      <td className="num">
                        <span style={{ fontWeight: 600, color: s.health.tone === 'good' ? 'var(--good)' : s.health.tone === 'watch' ? 'var(--high)' : 'var(--critical)' }}>
                          {s.health.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="reveal" data-delay="1">
          <PanelHead title="Needs attention" sub="Blockers, overdue items and critical findings" />
          {attention.length === 0 ? (
            <Empty title="Nothing blocked" body="Every active engagement can progress to its next stage." />
          ) : (
            <div>
              {attention.map((a, i) => (
                <Link key={i} href={`/engagements/${a.snap.engagement.id}`}
                  style={{ display: 'block', padding: '11px 16px', borderBottom: i === attention.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
                    <Chip tone={a.tone} dot>{a.kind}</Chip>
                    <span className="mono" style={{ color: 'var(--ink-faint)' }}>{a.snap.engagement.reference}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55 }}>{a.text}</div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="Pipeline by stage" />
          <div className="panel-body" style={{ display: 'grid', gap: 9 }}>
            {stageCounts.map((s) => (
              <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-subtle)', width: 150, flex: 'none' }}>{STAGE_META[s.stage].label}</span>
                <div style={{ flex: 1, height: 18, background: 'var(--surface-3)', borderRadius: 'var(--radius-xs)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    width: `${active.length ? (s.count / active.length) * 100 : 0}%`, height: '100%',
                    background: s.count ? 'var(--accent)' : 'transparent', borderRadius: 'var(--radius-xs)',
                  }} />
                </div>
                <span className="mono" style={{ width: 20, textAlign: 'right', color: 'var(--ink)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Recent activity" actions={<Link className="btn btn-sm" href="/audit">Full trail</Link>} />
          {recent.length === 0 ? <Empty title="No activity yet" /> : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {recent.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', gap: 9, padding: '9px 16px', borderBottom: i === recent.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <Avatar name={a.actorName} color={staffById.get(a.actorId ?? '')?.avatarColor ?? 'var(--surface-3)'} size={22} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5 }}>
                      <strong style={{ fontWeight: 600 }}>{a.actorName}</strong>{' '}
                      <span style={{ color: 'var(--ink-subtle)' }}>{humanAction(a.action, a.entityType)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{relTime(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function humanAction(a: string, entityType: string) {
  const map: Record<string, string> = {
    'auth.login': 'signed in', 'auth.logout': 'signed out',
    'agent.run': 'ran an agent', 'document.upload': 'uploaded a document',
    'document.review': 'reviewed a document', 'document.delete': 'removed a document',
    'finding.update': 'updated a finding', 'engagement.create': 'opened an engagement',
    'engagement.stage': 'advanced the stage', 'client.create': 'added a client',
    'client.update': 'updated a client', 'report.approve': 'approved a report',
    'report.update': 'edited a report', 'requirement.update': 'updated a requirement',
    'risk.update': 'updated a risk', 'risk.create': 'added a risk',
    'prospectus.update': 'edited a document section', 'contract.create': 'created a contract',
    'contract.update': 'updated a contract', 'milestone.update': 'updated a milestone',
    'user.create': 'created an account', 'meeting.create': 'scheduled a meeting',
    'meeting.update': 'updated a meeting', 'task.create': 'added a task', 'task.update': 'updated a task',
  };
  const phrase = map[a];
  if (phrase) return phrase;
  const [entity, verb] = a.split('.');
  return `${verb ?? a} ${entity ?? entityType}`.replace(/_/g, ' ');
}
