'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Chip, StatusChip, Empty } from '@/components/ui';
import { renderMarkdown } from '@/lib/markdown';
import { fmtDateTime, titleCase } from '@/lib/domain';
import type { DDReport, ReportSection } from '@/lib/types';

type Report = DDReport & { reviewerName: string | null };

export default function ReportWorkspace({ reports, canApprove }: { reports: Report[]; canApprove: boolean }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(reports[0]?.id ?? '');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = reports.find((r) => r.id === activeId) ?? reports[0];
  if (!report) {
    return (
      <Panel>
        <Empty title="No reports yet"
          body="Run the Legal or Financial agent to produce a due diligence draft, or the Risk agent for the risk assessment report. Every draft is marked for expert review before it can be approved." />
      </Panel>
    );
  }

  const sections: ReportSection[] = safeParse(report.sections);

  async function save(next: { sections?: ReportSection[]; executiveSummary?: string; status?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setEditing(null);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  }

  function startEdit(s: ReportSection) { setEditing(s.id); setDraft(s.body); }
  function commitEdit() {
    const next = sections.map((s) => (s.id === editing ? { ...s, body: draft, edited: true, agentGenerated: false } : s));
    save({ sections: next });
  }

  return (
    <div className="split-grid">
      <Panel>
        <PanelHead title="Reports" />
        <div>
          {reports.map((r, i) => (
            <button key={r.id} onClick={() => { setActiveId(r.id); setEditing(null); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer',
                borderBottom: i === reports.length - 1 ? 'none' : '1px solid var(--hairline)',
                background: r.id === report.id ? 'var(--surface-3)' : 'transparent',
              }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                <Chip tone="neutral">{titleCase(r.kind)}</Chip>
                <span className="mono" style={{ color: 'var(--ink-faint)' }}>v{r.version}</span>
                <StatusChip status={r.status} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: r.id === report.id ? 600 : 450, lineHeight: 1.4 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                {r.generatedBy === 'ANTHROPIC' ? 'Reasoning draft' : 'Rule-engine draft'} · {fmtDateTime(r.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <div style={{ display: 'grid', gap: 12 }}>
        <Panel>
          <PanelHead
            title={report.title}
            sub={`Version ${report.version} · ${titleCase(report.status)}${report.reviewerName ? ` · reviewer ${report.reviewerName}` : ''}`}
            actions={
              <>
                {report.status === 'DRAFT' ? (
                  <button className="btn btn-sm" disabled={busy} onClick={() => save({ status: 'IN_REVIEW' })}>Take for review</button>
                ) : null}
                {report.status !== 'APPROVED' && canApprove ? (
                  <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => save({ status: 'APPROVED' })}>Approve</button>
                ) : null}
              </>
            }
          />
          <div style={{ padding: '11px 16px', background: 'var(--high-soft)', borderBottom: '1px solid var(--hairline)', fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--high)' }}>Machine-assisted draft.</strong>{' '}
            {report.status === 'APPROVED'
              ? `Approved${report.approvedAt ? ` on ${fmtDateTime(report.approvedAt)}` : ''} by ${report.reviewerName ?? 'the reviewing expert'}.`
              : 'This report has not been approved. It must not be issued to the client or any third party until a responsible expert has reviewed every section and approved it here.'}
          </div>
          {error ? <div style={{ padding: '9px 16px', fontSize: 12.5, color: 'var(--critical)' }}>{error}</div> : null}

          <div className="panel-body">
            <div className="eyebrow" style={{ marginBottom: 7 }}>Executive summary</div>
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(report.executiveSummary ?? '_Not drafted._') }} />
          </div>
        </Panel>

        {sections.map((s) => (
          <Panel key={s.id}>
            <PanelHead
              title={s.heading}
              sub={s.edited ? 'Edited by a reviewer' : s.agentGenerated ? `Agent draft (${s.source ?? 'rules'})` : 'Reviewer section'}
              actions={
                editing === s.id ? (
                  <>
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={commitEdit}>Save</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : (
                  report.status !== 'APPROVED'
                    ? <button className="btn btn-sm" onClick={() => startEdit(s)}>Edit</button>
                    : null
                )
              }
            />
            <div className="panel-body">
              {editing === s.id ? (
                <textarea className="textarea" style={{ minHeight: 320, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
                  value={draft} onChange={(e) => setDraft(e.target.value)} />
              ) : (
                <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }} />
              )}
            </div>
          </Panel>
        ))}
      </div>


    </div>
  );
}

function safeParse(s: string): ReportSection[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
