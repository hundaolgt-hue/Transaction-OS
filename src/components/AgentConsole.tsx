'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Chip, StatusChip, Empty } from '@/components/ui';
import { AGENT_META, AGENTS, titleCase, relTime, fmtDateTime, type AgentKey } from '@/lib/domain';
import type { AgentRun, AgentLog } from '@/lib/types';

type RunWithLogs = AgentRun & { logs: AgentLog[] };

export default function AgentConsole({
  engagementId, runs, aiEnabled, model, canRun, context, meetings, sections,
}: {
  engagementId: string; runs: RunWithLogs[]; aiEnabled: boolean; model: string; canRun: boolean;
  context: Record<string, number | string>;
  meetings: { id: string; title: string; scheduledAt: string; distributed: boolean }[];
  sections: { code: string; heading: string; status: string }[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState(meetings[0]?.id ?? '');
  const [sectionCode, setSectionCode] = useState('');

  async function run(agent: AgentKey) {
    setRunning(agent);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {};
      if (agent === 'SECRETARY' && meetingId) payload.meetingId = meetingId;
      if (agent === 'PROSPECTUS' && sectionCode) payload.sectionCode = sectionCode;

      const res = await fetch(`/api/engagements/${engagementId}/agents`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent, payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'The agent run failed');
      setResult({ tone: 'ok', text: json.summary });
      router.refresh();
    } catch (e) {
      setResult({ tone: 'err', text: e instanceof Error ? e.message : 'The agent run failed' });
    } finally { setRunning(null); }
  }

  const lastByAgent = new Map<string, RunWithLogs>();
  for (const r of runs) if (!lastByAgent.has(r.agent)) lastByAgent.set(r.agent, r);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: aiEnabled ? 'var(--good)' : 'var(--high)', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {aiEnabled ? `Reasoning engine active — ${model}` : 'Deterministic rule engine only'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2, lineHeight: 1.5 }}>
            {aiEnabled
              ? 'Agents run the rule pack first, then a reasoning pass for judgement-based gaps. Both are recorded separately.'
              : 'Every agent works from the versioned rule pack. Set ANTHROPIC_API_KEY to add the reasoning pass — no other change is required.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--ink-faint)', flexWrap: 'wrap' }}>
          <span><strong style={{ color: 'var(--ink)' }}>{context.documents}</strong> documents</span>
          <span><strong style={{ color: 'var(--ink)' }}>{context.completeness}%</strong> complete</span>
          <span><strong style={{ color: 'var(--ink)' }}>{context.findings}</strong> open findings</span>
          <span><strong style={{ color: 'var(--ink)' }}>{context.risks}</strong> risks</span>
        </div>
      </div>

      {result ? (
        <div role="status" style={{
          fontSize: 12.5, padding: '10px 12px', borderRadius: 'var(--radius-md)', lineHeight: 1.55,
          color: result.tone === 'ok' ? 'var(--good)' : 'var(--critical)',
          background: result.tone === 'ok' ? 'var(--good-soft)' : 'var(--critical-soft)',
        }}>{result.text}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        {AGENTS.map((key) => {
          const meta = AGENT_META[key];
          const last = lastByAgent.get(key);
          return (
            <div key={key} className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', background: `${meta.accent}22`, border: `1px solid ${meta.accent}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.accent }} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{meta.name}</div>
                    {last ? (
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                        Last run {relTime(last.createdAt)} · {last.engine === 'ANTHROPIC' ? 'reasoning' : 'rules'}
                      </div>
                    ) : <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Never run</div>}
                  </div>
                  {last ? <StatusChip status={last.status} /> : null}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: 0, lineHeight: 1.55 }}>{meta.blurb}</p>
              </div>

              <div style={{ padding: '10px 16px', flex: 1 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Expertise</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {meta.expertise.map((e) => <Chip key={e} tone="neutral">{e}</Chip>)}
                </div>
                {last?.summary ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 10, lineHeight: 1.55 }}>{last.summary}</p>
                ) : null}
              </div>

              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--hairline)', display: 'grid', gap: 8 }}>
                {key === 'SECRETARY' && meetings.length ? (
                  <select className="select" value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
                    {meetings.map((m) => <option key={m.id} value={m.id}>{m.title} — {new Date(m.scheduledAt).toLocaleDateString('en-GB')}</option>)}
                  </select>
                ) : null}
                {key === 'PROSPECTUS' ? (
                  <select className="select" value={sectionCode} onChange={(e) => setSectionCode(e.target.value)}>
                    <option value="">Next four undrafted sections</option>
                    {sections.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.heading} ({titleCase(s.status)})</option>)}
                  </select>
                ) : null}
                <button className="btn btn-primary" disabled={!canRun || running !== null} onClick={() => run(key)}>
                  {running === key ? 'Running…' : `Run ${meta.short} Agent`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Panel>
        <PanelHead title="Run history" sub="Every run, its engine, its cost and its log" />
        {runs.length === 0 ? <Empty title="No runs yet" body="Run an agent above to begin." /> : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Agent</th><th>Status</th><th>Engine</th><th className="num">Findings</th>
                  <th className="num">Tokens</th><th className="num">Duration</th><th>When</th><th />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ fontWeight: 500 }}>{AGENT_META[r.agent as AgentKey]?.short ?? r.agent}</td>
                      <td><StatusChip status={r.status} /></td>
                      <td><Chip tone={r.engine === 'ANTHROPIC' ? 'good' : 'neutral'}>{r.engine === 'ANTHROPIC' ? 'Reasoning' : 'Rules'}</Chip></td>
                      <td className="num">{r.findingsCount}</td>
                      <td className="num mono">{r.tokensIn + r.tokensOut ? (r.tokensIn + r.tokensOut).toLocaleString() : '—'}</td>
                      <td className="num mono">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{fmtDateTime(r.createdAt)}</td>
                      <td>
                        <button className="btn btn-sm btn-ghost" onClick={() => setOpenRun(openRun === r.id ? null : r.id)}>
                          {openRun === r.id ? 'Hide log' : 'Log'}
                        </button>
                      </td>
                    </tr>
                    {openRun === r.id ? (
                      <tr>
                        <td colSpan={8} style={{ background: 'var(--surface-2)' }}>
                          {r.error ? <div style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 8 }}>{r.error}</div> : null}
                          <div style={{ display: 'grid', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-subtle)' }}>
                            {r.logs.length === 0 ? <span>No log entries.</span> : r.logs.map((l) => (
                              <div key={l.id} style={{ display: 'flex', gap: 8 }}>
                                <span style={{ color: l.level === 'ERROR' ? 'var(--critical)' : l.level === 'WARN' ? 'var(--high)' : 'var(--ink-faint)', flex: 'none' }}>
                                  {new Date(l.createdAt).toLocaleTimeString('en-GB')}
                                </span>
                                <span>{l.message}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
