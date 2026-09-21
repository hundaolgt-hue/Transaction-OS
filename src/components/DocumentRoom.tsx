'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Meter, Chip, StatusChip, Empty, Grid, Stat } from '@/components/ui';
import { titleCase, fmtDate, relTime, REQUIREMENT_STATUSES } from '@/lib/domain';
import type { Requirement, Document } from '@/lib/types';
import type { CompletenessResult } from '@/lib/progress';

const FILTERS = ['ALL', 'OUTSTANDING', 'IN_REVIEW', 'ACCEPTED'] as const;

export default function DocumentRoom({ engagementId, role, threshold, completeness, requirements, documents }: {
  engagementId: string; role: string; threshold: number;
  completeness: CompletenessResult; requirements: Requirement[]; documents: Document[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const docsByReq = useMemo(() => {
    const m = new Map<string, Document[]>();
    for (const d of documents) {
      const k = d.requirementId ?? '__unfiled';
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return m;
  }, [documents]);

  const categories = useMemo(() => ['ALL', ...new Set(requirements.map((r) => r.category))], [requirements]);

  const visible = requirements.filter((r) => {
    if (category !== 'ALL' && r.category !== category) return false;
    if (query && !`${r.code} ${r.title} ${r.description ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'OUTSTANDING') return ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status);
    if (filter === 'IN_REVIEW') return ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status);
    if (filter === 'ACCEPTED') return ['ACCEPTED', 'WAIVED'].includes(r.status);
    return true;
  });

  const unfiled = docsByReq.get('__unfiled') ?? [];

  function flash(tone: 'ok' | 'err', text: string) {
    setToast({ tone, text });
    setTimeout(() => setToast(null), 4500);
  }

  async function upload(files: FileList | null, requirementId: string | null) {
    if (!files?.length) return;
    setBusy(requirementId ?? 'unfiled');
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set('file', file);
        fd.set('title', file.name.replace(/\.[^.]+$/, ''));
        if (requirementId) fd.set('requirementId', requirementId);
        const res = await fetch(`/api/engagements/${engagementId}/documents`, { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Upload failed');
        flash('ok', json.matchedRequirement
          ? `"${file.name}" filed against ${json.matchedRequirement.code}. ${json.extractedChars > 0 ? `${json.extractedChars.toLocaleString()} characters extracted for the agents.` : 'No text could be extracted — the agents will skip it.'}`
          : `"${file.name}" uploaded but not matched to a requirement. File it manually so it counts toward completeness.`);
      }
      router.refresh();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function patchDoc(documentId: string, body: Record<string, unknown>) {
    setBusy(documentId);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      router.refresh();
    } catch (e) { flash('err', e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(null); }
  }

  async function patchReq(requirementId: string, body: Record<string, unknown>) {
    setBusy(requirementId);
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      flash('ok', 'Requirement updated.');
      router.refresh();
    } catch (e) { flash('err', e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(null); }
  }

  const canReview = role !== 'CLIENT';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <input ref={fileInput} type="file" multiple hidden
        onChange={(e) => upload(e.target.files, uploadTarget)} />

      <Grid min={185}>
        <Stat label="Completeness" value={`${completeness.percent}%`}
          tone={completeness.percent >= threshold ? 'good' : completeness.percent >= 40 ? 'medium' : 'high'}
          sub={`${threshold}% threshold to advance`} />
        <Stat label="Accepted" value={completeness.accepted} tone="good" sub={`of ${completeness.total} requirements`} />
        <Stat label="Awaiting review" value={completeness.submitted} tone={completeness.submitted ? 'low' : 'neutral'} sub="Submitted or under review" />
        <Stat label="Outstanding" value={completeness.missing} tone={completeness.missing ? 'high' : 'good'}
          sub={`${completeness.mandatoryMissing} mandatory`} />
        <Stat label="Rejected" value={completeness.rejected} tone={completeness.rejected ? 'critical' : 'neutral'} sub="Returned to the client" />
      </Grid>

      {toast ? (
        <div role="status" style={{
          fontSize: 12.5, padding: '9px 12px', borderRadius: 'var(--radius-md)', lineHeight: 1.5,
          color: toast.tone === 'ok' ? 'var(--good)' : 'var(--critical)',
          background: toast.tone === 'ok' ? 'var(--good-soft)' : 'var(--critical-soft)',
        }}>{toast.text}</div>
      ) : null}

      <Panel>
        <PanelHead
          title="Document checklist"
          sub={`${visible.length} of ${requirements.length} requirements shown`}
          actions={
            <>
              <button className="btn btn-sm" onClick={() => { setUploadTarget(null); fileInput.current?.click(); }} disabled={busy === 'unfiled'}>
                {busy === 'unfiled' ? 'Uploading…' : 'Upload & auto-file'}
              </button>
            </>
          }
        />
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 2, borderRadius: 'var(--radius-md)' }}>
            {FILTERS.map((f) => (
              <button key={f} className="btn btn-sm btn-ghost"
                onClick={() => setFilter(f)}
                style={{ background: filter === f ? 'var(--surface-1)' : 'transparent', color: filter === f ? 'var(--ink)' : undefined }}>
                {titleCase(f)}
              </button>
            ))}
          </div>
          <select className="select" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All categories' : titleCase(c)}</option>)}
          </select>
          <input className="input" style={{ width: 'auto', flex: '1 1 180px', minWidth: 140 }} placeholder="Search requirements…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {visible.length === 0 ? <Empty title="Nothing matches" body="Adjust the filters above." /> : (
          <div>
            {visible.map((r, i) => {
              const docs = docsByReq.get(r.id) ?? [];
              const open = expanded === r.id;
              return (
                <div key={r.id} style={{ borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <div style={{ padding: '11px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <button onClick={() => setExpanded(open ? null : r.id)}
                      aria-expanded={open}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: '1 1 340px', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                        <span className="mono" style={{ color: 'var(--ink-faint)' }}>{r.code}</span>
                        <StatusChip status={r.status} />
                        {r.mandatory ? <Chip tone="neutral">Mandatory</Chip> : <Chip tone="info">Optional</Chip>}
                        <Chip tone="neutral">{titleCase(r.category)}</Chip>
                        {docs.length ? <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{docs.length} file{docs.length === 1 ? '' : 's'}</span> : null}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.title}</div>
                      {r.authorityRef ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{r.authorityRef}</div> : null}
                    </button>

                    <div style={{ display: 'flex', gap: 6, flex: 'none', alignItems: 'center' }}>
                      <button className="btn btn-sm" disabled={busy === r.id}
                        onClick={() => { setUploadTarget(r.id); fileInput.current?.click(); }}>
                        {busy === r.id ? 'Uploading…' : 'Upload'}
                      </button>
                      {canReview ? (
                        <select className="select btn-sm" style={{ width: 'auto', height: 26, padding: '0 24px 0 8px', fontSize: 12 }}
                          value={r.status}
                          onChange={(e) => {
                            const status = e.target.value;
                            if (status === 'WAIVED') {
                              const reason = window.prompt('Record the reason for the waiver (kept in the audit trail):');
                              if (!reason) return;
                              patchReq(r.id, { status, waivedReason: reason });
                            } else {
                              patchReq(r.id, { status });
                            }
                          }}>
                          {REQUIREMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                        </select>
                      ) : null}
                    </div>
                  </div>

                  {open ? (
                    <div className="fade-up" style={{ padding: '0 16px 14px', display: 'grid', gap: 10 }}>
                      {r.description ? <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: 0, lineHeight: 1.6 }}>{r.description}</p> : null}
                      {r.waivedReason ? (
                        <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                          <strong>Waived:</strong> {r.waivedReason}
                        </div>
                      ) : null}

                      {docs.length === 0 ? (
                        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: 0 }}>No document has been uploaded against this requirement.</p>
                      ) : (
                        <div style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                          {docs.map((d, j) => (
                            <DocRow key={d.id} doc={d} canReview={canReview} busy={busy === d.id}
                              last={j === docs.length - 1} onPatch={patchDoc} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {unfiled.length ? (
        <Panel>
          <PanelHead title="Unfiled documents" sub="Uploaded but not matched to a requirement — these do not count toward completeness" />
          <div>
            {unfiled.map((d, j) => (
              <UnfiledRow key={d.id} doc={d} requirements={requirements} busy={busy === d.id}
                last={j === unfiled.length - 1} onPatch={patchDoc} />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function DocRow({ doc, canReview, busy, last, onPatch }: {
  doc: Document; canReview: boolean; busy: boolean; last: boolean;
  onPatch: (id: string, body: Record<string, unknown>) => void;
}) {
  return (
    <div style={{ padding: '9px 12px', borderBottom: last ? 'none' : '1px solid var(--hairline)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface-2)' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={`/api/documents/${doc.id}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{doc.title}</a>
          <Chip tone="neutral">v{doc.version}</Chip>
          <StatusChip status={doc.status} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
          {doc.fileName} · {(doc.sizeBytes / 1024).toFixed(0)} KB
          {doc.pageCount ? ` · ${doc.pageCount} pages` : ''} · uploaded {relTime(doc.createdAt)}
        </div>
        {doc.reviewNote ? <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 4 }}><strong>Note:</strong> {doc.reviewNote}</div> : null}
      </div>
      {canReview ? (
        <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
          <button className="btn btn-sm" disabled={busy || doc.status === 'ACCEPTED'} onClick={() => onPatch(doc.id, { status: 'ACCEPTED' })}>Accept</button>
          <button className="btn btn-sm btn-danger" disabled={busy}
            onClick={() => {
              const note = window.prompt('Why is this document being returned? The client sees this note.');
              if (note === null) return;
              onPatch(doc.id, { status: 'REJECTED', reviewNote: note });
            }}>Return</button>
        </div>
      ) : null}
    </div>
  );
}

function UnfiledRow({ doc, requirements, busy, last, onPatch }: {
  doc: Document; requirements: Requirement[]; busy: boolean; last: boolean;
  onPatch: (id: string, body: Record<string, unknown>) => void;
}) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: last ? 'none' : '1px solid var(--hairline)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <a href={`/api/documents/${doc.id}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{doc.title}</a>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{doc.fileName} · uploaded {relTime(doc.createdAt)}</div>
      </div>
      <select className="select" style={{ width: 'auto', flex: '0 1 300px' }} defaultValue="" disabled={busy}
        onChange={(e) => e.target.value && onPatch(doc.id, { requirementId: e.target.value, status: 'SUBMITTED' })}>
        <option value="">File against a requirement…</option>
        {requirements.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.title}</option>)}
      </select>
    </div>
  );
}
