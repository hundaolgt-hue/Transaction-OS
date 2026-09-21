'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Meter, Chip, StatusChip, Empty, Stat, Grid } from '@/components/ui';
import { renderMarkdown } from '@/lib/markdown';
import { titleCase, relTime } from '@/lib/domain';
import type { ProspectusSection } from '@/lib/types';

export default function ProspectusBuilder({ engagementId, sections, progress, guidance, packName, outputLabel }: {
  engagementId: string;
  sections: ProspectusSection[];
  progress: { percent: number; drafted: number; approved: number; total: number };
  guidance: Record<string, { guidance: string; minWords: number }>;
  packName: string;
  outputLabel: string;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const section = sections.find((s) => s.id === activeId) ?? sections[0];
  if (!section) return <Panel><Empty title={`No ${outputLabel.toLowerCase()} skeleton`} body="The rule pack for this engagement does not define document sections." /></Panel>;
  const g = guidance[section.code];

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospectus/${section.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setEditing(false);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  }

  async function draftWithAgent() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/agents`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: 'PROSPECTUS', payload: { sectionCode: section.code } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'The agent run failed');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'The agent run failed'); }
    finally { setBusy(false); }
  }

  const wordTarget = g?.minWords ?? 350;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Grid min={180}>
        <Stat label={`${outputLabel} complete`} value={`${progress.percent}%`} tone={progress.percent >= 75 ? 'good' : 'medium'} sub={packName} />
        <Stat label="Sections drafted" value={`${progress.drafted}/${progress.total}`} />
        <Stat label="Approved" value={progress.approved} tone={progress.approved === progress.total ? 'good' : 'neutral'} />
        <Stat label="Not started" value={sections.filter((s) => s.status === 'NOT_STARTED').length} tone="high" />
      </Grid>

      <div className="split-grid split-grid-wide">
        <Panel>
          <PanelHead title="Contents" sub={`${sections.length} prescribed sections`} />
          <div style={{ maxHeight: 620, overflowY: 'auto' }}>
            {sections.map((s, i) => (
              <button key={s.id} onClick={() => { setActiveId(s.id); setEditing(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', cursor: 'pointer',
                  borderBottom: i === sections.length - 1 ? 'none' : '1px solid var(--hairline)',
                  background: s.id === section.id ? 'var(--surface-3)' : 'transparent',
                }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                  <span className="mono" style={{ color: 'var(--ink-faint)' }}>{s.code}</span>
                  <StatusChip status={s.status} dot={false} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: s.id === section.id ? 600 : 450, lineHeight: 1.4, marginBottom: 5 }}>{s.heading}</div>
                <Meter value={s.completeness} showValue={false} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title={`${section.code} — ${section.heading}`}
            sub={`${section.wordCount} words${wordTarget ? ` of ~${wordTarget} target` : ''}${section.generatedBy ? ` · ${section.generatedBy === 'ANTHROPIC' ? 'agent draft' : section.generatedBy === 'HUMAN' ? 'edited by a reviewer' : 'skeleton'}` : ''}`}
            actions={
              editing ? (
                <>
                  <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => save({ body: draft, status: 'DRAFTED' })}>Save</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm" disabled={busy} onClick={draftWithAgent}>{busy ? 'Drafting…' : 'Draft with agent'}</button>
                  <button className="btn btn-sm" onClick={() => { setDraft(section.body); setEditing(true); }}>Edit</button>
                  <select className="select btn-sm" style={{ width: 'auto', height: 26, padding: '0 24px 0 8px', fontSize: 12 }}
                    value={section.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
                    {['NOT_STARTED', 'DRAFTING', 'DRAFTED', 'IN_REVIEW', 'APPROVED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </select>
                </>
              )
            }
          />

          {section.requiredBy ? (
            <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--hairline)', fontSize: 11.5, color: 'var(--ink-faint)' }}>
              Required by: {section.requiredBy}
            </div>
          ) : null}
          {g?.guidance ? (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hairline)', fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.6, background: 'var(--surface-2)' }}>
              <strong style={{ color: 'var(--ink)' }}>Drafting guidance.</strong> {g.guidance}
            </div>
          ) : null}
          {error ? <div style={{ padding: '9px 16px', fontSize: 12.5, color: 'var(--critical)' }}>{error}</div> : null}

          <div className="panel-body">
            {editing ? (
              <textarea className="textarea" style={{ minHeight: 460, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
                value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Draft the section in markdown…" />
            ) : section.body.trim() ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(section.body) }} />
            ) : (
              <Empty title="Not drafted"
                body="Use “Draft with agent” to generate a structured draft from the documents on file, or write it yourself."
                action={<button className="btn btn-primary btn-sm" onClick={draftWithAgent} disabled={busy}>Draft with agent</button>} />
            )}
          </div>

          {section.reviewNote ? (
            <div style={{ padding: '11px 16px', borderTop: '1px solid var(--hairline)', fontSize: 12.5, color: 'var(--ink-muted)' }}>
              <strong>Review note:</strong> {section.reviewNote}
            </div>
          ) : null}
          <div style={{ padding: '9px 16px', borderTop: '1px solid var(--hairline)', fontSize: 11, color: 'var(--ink-faint)' }}>
            Last updated {relTime(section.updatedAt)}
          </div>
        </Panel>
      </div>


    </div>
  );
}
