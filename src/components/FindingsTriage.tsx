'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Stat, Chip, StatusChip, SeverityChip, Empty, Grid } from '@/components/ui';
import { AGENT_META, GAP_LABEL, SEVERITIES, FINDING_STATUSES, titleCase, relTime, type AgentKey, type GapType } from '@/lib/domain';
import type { Finding } from '@/lib/types';
import type { ComplianceResult } from '@/lib/progress';

export default function FindingsTriage({
  engagementId, findings, compliance, staff, docTitles, reqTitles, canReview,
}: {
  engagementId: string; findings: Finding[]; compliance: ComplianceResult;
  staff: { id: string; name: string }[];
  docTitles: Record<string, string>; reqTitles: Record<string, string>; canReview: boolean;
}) {
  const router = useRouter();
  const [severity, setSeverity] = useState('ALL');
  const [agent, setAgent] = useState('ALL');
  const [status, setStatus] = useState('LIVE');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => findings.filter((f) => {
    if (severity !== 'ALL' && f.severity !== severity) return false;
    if (agent !== 'ALL' && f.agent !== agent) return false;
    if (status === 'LIVE') return ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status);
    if (status === 'CLOSED') return ['RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'].includes(f.status);
    if (status !== 'ALL') return f.status === status;
    return true;
  }), [findings, severity, agent, status]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      setNote('');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Grid min={175}>
        <Stat label="Compliance score" value={compliance.score}
          tone={compliance.score >= 75 ? 'good' : compliance.score >= 45 ? 'medium' : 'critical'}
          sub="100 is a clean file" />
        <Stat label="Critical" value={compliance.critical} tone={compliance.critical ? 'critical' : 'good'} sub="Must clear before filing" />
        <Stat label="High" value={compliance.high} tone={compliance.high ? 'high' : 'good'} />
        <Stat label="Medium & low" value={compliance.medium + compliance.low} tone="medium" />
        <Stat label="Closed" value={compliance.resolved} tone="good" sub="Resolved, dismissed or false positive" />
      </Grid>

      <Panel>
        <PanelHead title="Findings" sub={`${visible.length} shown of ${findings.length}`} />
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="LIVE">Live findings</option>
            <option value="CLOSED">Closed</option>
            <option value="ALL">All</option>
            {FINDING_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="ALL">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="ALL">All agents</option>
            {Object.entries(AGENT_META).map(([k, v]) => <option key={k} value={k}>{v.short}</option>)}
          </select>
        </div>

        {error ? <div style={{ padding: '9px 16px', fontSize: 12.5, color: 'var(--critical)' }}>{error}</div> : null}

        {visible.length === 0 ? (
          <Empty title="No findings match"
            body={findings.length === 0 ? 'Run the legal or financial agent from the Agents tab to test the documents against the rule pack.' : 'Adjust the filters above.'} />
        ) : (
          <div>
            {visible.map((f, i) => {
              const isOpen = open === f.id;
              return (
                <div key={f.id} id={f.id} style={{ borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <button onClick={() => { setOpen(isOpen ? null : f.id); setNote(''); }}
                    aria-expanded={isOpen}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', display: 'block' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <SeverityChip severity={f.severity} />
                      <Chip tone="neutral">{AGENT_META[f.agent as AgentKey]?.short ?? f.agent}</Chip>
                      <Chip tone="info">{GAP_LABEL[f.gapType as GapType] ?? f.gapType}</Chip>
                      <StatusChip status={f.status} />
                      {f.humanVerdict ? <Chip tone={f.humanVerdict === 'CONFIRMED' ? 'good' : 'info'}>{titleCase(f.humanVerdict)}</Chip> : null}
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
                        {Math.round(f.confidence * 100)}% confidence · {relTime(f.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.45 }}>{f.title}</div>
                    {f.citation ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 3 }}>{f.citation}</div> : null}
                  </button>

                  {isOpen ? (
                    <div className="fade-up" style={{ padding: '0 16px 16px', display: 'grid', gap: 12 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{f.detail}</div>

                      {f.excerpt ? (
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '9px 11px', borderRadius: 'var(--radius-md)', borderLeft: '2px solid var(--accent-line)', color: 'var(--ink-subtle)', lineHeight: 1.6 }}>
                          {f.excerpt}
                        </div>
                      ) : null}

                      {f.recommendation ? (
                        <div>
                          <div className="eyebrow" style={{ marginBottom: 4 }}>Recommended action</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>{f.recommendation}</div>
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--ink-faint)' }}>
                        {f.documentId ? <span>Document: {docTitles[f.documentId] ?? '—'}</span> : null}
                        {f.requirementId ? <span>Requirement: {reqTitles[f.requirementId] ?? '—'}</span> : null}
                        <span>Visible to client: {f.visibleToClient ? 'yes' : 'no'}</span>
                      </div>

                      {canReview ? (
                        <div style={{ display: 'grid', gap: 9, paddingTop: 11, borderTop: '1px solid var(--hairline)' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select className="select" style={{ width: 'auto' }} value={f.status} disabled={busy === f.id}
                              onChange={(e) => patch(f.id, { status: e.target.value, resolutionNote: note || undefined })}>
                              {FINDING_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                            </select>
                            <select className="select" style={{ width: 'auto' }} value={f.severity} disabled={busy === f.id}
                              onChange={(e) => patch(f.id, { severity: e.target.value })}>
                              {SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                            </select>
                            <select className="select" style={{ width: 'auto' }} value={f.assigneeId ?? ''} disabled={busy === f.id}
                              onChange={(e) => patch(f.id, { assigneeId: e.target.value || null })}>
                              <option value="">Unassigned</option>
                              {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-subtle)' }}>
                              <input type="checkbox" checked={Boolean(f.visibleToClient)} disabled={busy === f.id}
                                onChange={(e) => patch(f.id, { visibleToClient: e.target.checked })} />
                              Share with client
                            </label>
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-sm" disabled={busy === f.id}
                              onClick={() => patch(f.id, { humanVerdict: 'CONFIRMED', status: 'ACKNOWLEDGED', comment: note || undefined })}>
                              Confirm finding
                            </button>
                            <button className="btn btn-sm" disabled={busy === f.id}
                              onClick={() => patch(f.id, { humanVerdict: 'REJECTED', status: 'FALSE_POSITIVE', comment: note || 'Rejected on expert review.' })}>
                              Mark false positive
                            </button>
                            <button className="btn btn-sm btn-primary" disabled={busy === f.id}
                              onClick={() => patch(f.id, { status: 'RESOLVED', resolutionNote: note || 'Resolved.', comment: note || undefined })}>
                              Resolve
                            </button>
                          </div>

                          <textarea className="textarea" style={{ minHeight: 64 }} placeholder="Reviewer note — recorded against the finding and in the audit trail."
                            value={note} onChange={(e) => setNote(e.target.value)} />
                          {f.resolutionNote ? (
                            <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)' }}><strong>Resolution:</strong> {f.resolutionNote}</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
