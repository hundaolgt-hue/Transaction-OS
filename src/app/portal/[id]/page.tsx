import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { snapshot, getEngagement } from '@/lib/repo/core';
import { Panel, PanelHead, Stat, Grid, Empty } from '@/components/ui';
import { STAGES, STAGE_META, TRANSACTION_LABEL, fmtDate, fmtMoney, titleCase, stageIndex, type Stage, type TransactionType } from '@/lib/domain';
import PortalUpload from '@/components/PortalUpload';
import Chart from '@/components/Chart';
import { CountUp } from '@/components/Motion';
import { donut, SCREEN_THEME } from '@/lib/charts/svg';

export const dynamic = 'force-dynamic';

export default async function PortalEngagement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const eng = getEngagement(session.orgId, id);
  if (!eng || (session.role === 'CLIENT' && eng.clientId !== session.clientId)) notFound();

  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  const idx = stageIndex(s.engagement.stage);
  const outstanding = s.requirements.filter((r) => ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status));
  const inReview = s.requirements.filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status));
  const accepted = s.requirements.filter((r) => ['ACCEPTED', 'WAIVED'].includes(r.status));
  const sharedFindings = s.findings.filter((f) => f.visibleToClient && !['DISMISSED', 'FALSE_POSITIVE'].includes(f.status));
  const docsByReq = new Map<string, typeof s.documents>();
  for (const d of s.documents) {
    if (!d.requirementId) continue;
    docsByReq.set(d.requirementId, [...(docsByReq.get(d.requirementId) ?? []), d]);
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow"><Link href="/portal" style={{ color: 'inherit' }}>Portal</Link> / <span className="mono">{s.engagement.reference}</span></div>
        <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>{s.engagement.name}</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '3px 0 0' }}>
          {TRANSACTION_LABEL[s.engagement.transactionType as TransactionType] ?? s.engagement.transactionType}
          {s.engagement.targetRaise ? ` · ${fmtMoney(s.engagement.targetRaise, s.engagement.currency)}` : ''}
          {s.engagement.targetFilingDate ? ` · target filing ${fmtDate(s.engagement.targetFilingDate)}` : ''}
        </p>
      </header>

      <Grid min={190}>
        <Stat label="Overall progress" value={<CountUp value={s.completeness.percent} suffix="%" />}
          tone={s.completeness.percent >= 75 ? 'good' : s.completeness.percent >= 40 ? 'medium' : 'high'}
          sub="Of the documents your advisor needs" />
        <Stat label="Still needed" value={outstanding.length} tone={outstanding.length ? 'high' : 'good'} sub={`${outstanding.filter((r) => r.mandatory).length} required by the regulator`} />
        <Stat label="Being reviewed" value={inReview.length} tone={inReview.length ? 'low' : 'neutral'} />
        <Stat label="Accepted" value={accepted.length} tone="good" sub={`of ${s.requirements.length} items`} />
      </Grid>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', alignItems: 'start' }}>
      <Panel className="lift">
        <PanelHead title="Your document checklist" sub="Status of every item your advisor has requested" />
        <div className="panel-body">
          <Chart label="Donut of document checklist status" maxWidth={420} svg={donut({
            theme: SCREEN_THEME, width: 420, height: 200,
            centre: `${s.completeness.percent}%`, sub: 'complete',
            items: [
              { label: 'Accepted', value: accepted.length, color: 'var(--good)' },
              { label: 'Being reviewed', value: inReview.length, color: 'var(--low)' },
              { label: 'Still needed', value: outstanding.length, color: 'var(--high)' },
            ],
          })} />
          <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '10px 0 0', lineHeight: 1.55 }}>
            {outstanding.length
              ? `${outstanding.length} item${outstanding.length === 1 ? '' : 's'} still needed — upload below or ask the assistant what each one should contain.`
              : 'Nothing outstanding from you right now. Your advisor is reviewing what you submitted.'}
            {sharedFindings.length ? ` ${sharedFindings.length} point${sharedFindings.length === 1 ? '' : 's'} shared with you by your advisor.` : ''}
          </p>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="Where your transaction stands" sub={STAGE_META[s.engagement.stage as Stage]?.blurb} />
        <div className="panel-body">
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {STAGES.map((st, i) => {
              const done = i < idx, current = i === idx;
              return (
                <li key={st} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '7px 0' }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 99, flex: 'none', marginTop: 1,
                    background: done ? 'var(--accent)' : current ? 'transparent' : 'var(--surface-3)',
                    border: current ? '2px solid var(--accent)' : 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-ink)', fontSize: 10, fontWeight: 700,
                  }}>{done ? '✓' : ''}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: current ? 600 : 450, color: done || current ? 'var(--ink)' : 'var(--ink-faint)' }}>
                      {STAGE_META[st].label}
                      {current ? <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 8, fontWeight: 600 }}>IN PROGRESS</span> : null}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{STAGE_META[st].blurb}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Panel>
      </div>

      <PortalUpload
        engagementId={id}
        outstanding={outstanding.map((r) => ({
          id: r.id, code: r.code, title: r.title, description: r.description,
          mandatory: Boolean(r.mandatory), status: r.status, dueDate: r.dueDate,
          rejectionNote: (docsByReq.get(r.id) ?? []).find((d) => d.status === 'REJECTED')?.reviewNote ?? null,
        }))}
        inReview={inReview.map((r) => ({ id: r.id, code: r.code, title: r.title, status: r.status }))}
        accepted={accepted.map((r) => ({ id: r.id, code: r.code, title: r.title, status: r.status }))}
        completeness={s.completeness.percent}
      />

      {sharedFindings.length ? (
        <Panel>
          <PanelHead title="Items your advisor has raised with you" sub="Points that need your attention or a response" />
          <div>
            {sharedFindings.map((f, i) => (
              <div key={f.id} style={{ padding: '11px 16px', borderBottom: i === sharedFindings.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{f.detail}</div>
                {f.recommendation ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 7, paddingLeft: 11, borderLeft: '2px solid var(--accent-line)' }}>
                    <strong>What we need:</strong> {f.recommendation}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {s.milestones.length ? (
        <Panel>
          <PanelHead title="Milestones" sub="The plan agreed in your engagement letter" />
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>#</th><th>Milestone</th><th>Target date</th><th>Status</th></tr></thead>
              <tbody>
                {s.milestones.map((m) => (
                  <tr key={m.id}>
                    <td className="mono" style={{ color: 'var(--ink-faint)' }}>{m.sequence}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      {m.description ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{m.description}</div> : null}
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{fmtDate(m.dueDate)}</td>
                    <td style={{ fontSize: 12.5 }}>{titleCase(m.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
