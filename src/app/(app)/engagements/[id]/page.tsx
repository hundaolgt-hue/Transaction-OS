import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot, listStageEvents, listStaff } from '@/lib/repo/core';
import { Panel, PanelHead, Stat, Meter, Chip, StatusChip, SeverityChip, Empty, Grid, Defs } from '@/components/ui';
import { STAGE_META, AGENT_META, fmtMoney, fmtDate, relTime, titleCase, LEGAL_FORM_LABEL, type Stage, type AgentKey } from '@/lib/domain';
import { getRulePack } from '@/lib/rulepacks';

export const dynamic = 'force-dynamic';

export default async function EngagementOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  const pack = getRulePack(s.engagement.rulePackKey);
  const stageEvents = listStageEvents(id).slice(0, 6);
  const staff = listStaff(session.orgId);
  const lead = staff.find((u) => u.id === s.engagement.leadAdvisorId);
  const missing = s.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED'].includes(r.status));
  const topFindings = s.findings.filter((f) => ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status)).slice(0, 6);
  const upcoming = s.milestones.filter((m) => m.status !== 'COMPLETED').slice(0, 4);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Grid min={180}>
        <Stat label="Document completeness" value={`${s.completeness.percent}%`}
          tone={s.completeness.percent >= 75 ? 'good' : s.completeness.percent >= 40 ? 'medium' : 'high'}
          sub={`${s.completeness.accepted} accepted · ${s.completeness.submitted} in review · ${s.completeness.missing} outstanding`} />
        <Stat label="Compliance score" value={s.compliance.score}
          tone={s.compliance.score >= 75 ? 'good' : s.compliance.score >= 45 ? 'medium' : 'critical'}
          sub={`${s.compliance.open} open · ${s.compliance.critical} critical · ${s.compliance.high} high`} />
        <Stat label="Prospectus" value={`${s.prospectusProgress.percent}%`}
          tone={s.prospectusProgress.percent >= 75 ? 'good' : 'medium'}
          sub={`${s.prospectusProgress.drafted} of ${s.prospectusProgress.total} sections drafted`} />
        <Stat label="Engagement health" value={s.health.score}
          tone={s.health.tone === 'good' ? 'good' : s.health.tone === 'watch' ? 'medium' : 'critical'}
          sub={s.health.label} />
        <Stat label="Fees collected" value={`${s.fees.percentPaid}%`}
          sub={`${fmtMoney(s.fees.paid, s.engagement.currency)} received · ${fmtMoney(s.fees.outstanding, s.engagement.currency)} outstanding`} />
      </Grid>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="Outstanding mandatory documents" sub={`${missing.length} of ${s.requirements.filter((r) => r.mandatory).length} mandatory items`}
            actions={<Link className="btn btn-sm" href={`/engagements/${id}/documents`}>Document room</Link>} />
          {missing.length === 0 ? (
            <Empty title="All mandatory documents are on file" body="Run the legal and financial agents to test them against the rule pack." />
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {missing.slice(0, 12).map((r, i) => (
                <div key={r.id} style={{ padding: '10px 16px', borderBottom: i === Math.min(11, missing.length - 1) ? 'none' : '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                      <div className="mono" style={{ color: 'var(--ink-faint)', marginTop: 1 }}>{r.code} · weight {r.weight}</div>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                  {r.authorityRef ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>{r.authorityRef}</div> : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Open findings" sub="Ranked by severity"
            actions={<Link className="btn btn-sm" href={`/engagements/${id}/findings`}>Triage</Link>} />
          {topFindings.length === 0 ? (
            <Empty title="No open findings" body="Either the reviews have not run yet, or everything raised has been resolved." />
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {topFindings.map((f, i) => (
                <Link key={f.id} href={`/engagements/${id}/findings#${f.id}`}
                  style={{ display: 'block', padding: '10px 16px', borderBottom: i === topFindings.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                    <SeverityChip severity={f.severity} />
                    <Chip tone="neutral">{AGENT_META[f.agent as AgentKey]?.short ?? f.agent}</Chip>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{relTime(f.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{f.title}</div>
                  {f.citation ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 3 }}>{f.citation}</div> : null}
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="Completeness by category" />
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            {s.completeness.byCategory.map((c) => (
              <Meter key={c.category} value={c.percent} label={titleCase(c.category)} />
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Engagement detail" />
          <div className="panel-body">
            <Defs items={[
              ['Client', <Link key="c" href={`/clients/${s.client.id}`} style={{ color: 'var(--accent)' }}>{s.client.name}</Link>],
              ['Legal form', LEGAL_FORM_LABEL[s.client.legalForm] ?? s.client.legalForm],
              ['Sector', titleCase(s.client.sector)],
              ['Lead advisor', lead?.name ?? 'Unassigned'],
              ['Rule pack', <span key="p"><span className="mono">{pack.key} v{pack.version}</span> — {pack.name}</span>],
              ['Started', fmtDate(s.engagement.startDate)],
              ['Target filing', fmtDate(s.engagement.targetFilingDate)],
              ['Doc. threshold', `${s.engagement.documentThreshold}%`],
            ]} />
            {s.engagement.description ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '14px 0 0', lineHeight: 1.6, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                {s.engagement.description}
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Upcoming milestones" actions={<Link className="btn btn-sm" href={`/engagements/${id}/contract`}>Contract</Link>} />
          {upcoming.length === 0 ? <Empty title="No open milestones" body="Add a contract to generate the milestone plan." /> : (
            <div>
              {upcoming.map((m, i) => {
                const overdue = m.dueDate && new Date(m.dueDate) < new Date();
                return (
                  <div key={m.id} style={{ padding: '10px 16px', borderBottom: i === upcoming.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                      <span className="mono" style={{ color: 'var(--ink-muted)' }}>{fmtMoney(m.paymentAmount, s.engagement.currency)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 7, marginTop: 5, alignItems: 'center' }}>
                      <StatusChip status={m.status} />
                      <span style={{ fontSize: 11.5, color: overdue ? 'var(--critical)' : 'var(--ink-faint)' }}>
                        {overdue ? 'Overdue — ' : 'Due '}{fmtDate(m.dueDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Stage history" />
          {stageEvents.length === 0 ? <Empty title="No stage changes" /> : (
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              {stageEvents.map((e) => (
                <div key={e.id} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)', marginTop: 5, flex: 'none' }} />
                  <div>
                    <div style={{ fontSize: 12.5 }}>
                      {e.fromStage ? <><span style={{ color: 'var(--ink-faint)' }}>{STAGE_META[e.fromStage as Stage]?.label ?? e.fromStage}</span> → </> : null}
                      <strong style={{ fontWeight: 600 }}>{STAGE_META[e.toStage as Stage]?.label ?? e.toStage}</strong>
                    </div>
                    {e.note ? <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 2 }}>{e.note}</div> : null}
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{e.actorName} · {relTime(e.createdAt)}</div>
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
