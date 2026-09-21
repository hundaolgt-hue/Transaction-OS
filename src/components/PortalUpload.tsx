'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Chip, StatusChip, Meter, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/domain';

interface Item {
  id: string; code: string; title: string; status: string;
  description?: string | null; mandatory?: boolean; dueDate?: string | null; rejectionNote?: string | null;
}

export default function PortalUpload({ engagementId, outstanding, inReview, accepted, completeness }: {
  engagementId: string; outstanding: Item[]; inReview: Item[]; accepted: Item[]; completeness: number;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  async function upload(files: FileList | File[] | null, requirementId: string | null) {
    if (!files || !('length' in files) || files.length === 0) return;
    setBusy(requirementId ?? 'any');
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set('file', file);
        fd.set('title', file.name.replace(/\.[^.]+$/, ''));
        if (requirementId) fd.set('requirementId', requirementId);
        const res = await fetch(`/api/engagements/${engagementId}/documents`, { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      }
      setToast({ tone: 'ok', text: `Uploaded. Your advisor has been notified and will review it.` });
      router.refresh();
    } catch (e) {
      setToast({ tone: 'err', text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setBusy(null);
      setTarget(null);
      if (fileInput.current) fileInput.current.value = '';
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files, target)} />

      {toast ? (
        <div role="status" style={{
          fontSize: 12.5, padding: '10px 12px', borderRadius: 'var(--radius-md)',
          color: toast.tone === 'ok' ? 'var(--good)' : 'var(--critical)',
          background: toast.tone === 'ok' ? 'var(--good-soft)' : 'var(--critical-soft)',
        }}>{toast.text}</div>
      ) : null}

      <Panel>
        <PanelHead
          title="Documents we still need from you"
          sub={outstanding.length ? `${outstanding.length} outstanding · ${completeness}% of the file is complete` : 'Nothing outstanding right now'}
          actions={<button className="btn btn-sm" onClick={() => { setTarget(null); fileInput.current?.click(); }} disabled={busy === 'any'}>
            {busy === 'any' ? 'Uploading…' : 'Upload anything'}
          </button>} />

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <Meter value={completeness} label="Document completeness" />
        </div>

        {outstanding.length === 0 ? (
          <Empty title="Everything we asked for is in"
            body="Your advisor will let you know if anything further is needed as the review progresses." />
        ) : (
          <div>
            {outstanding.map((r, i) => (
              <div key={r.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(r.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); upload(e.dataTransfer.files, r.id); }}
                style={{
                  padding: '13px 16px',
                  borderBottom: i === outstanding.length - 1 ? 'none' : '1px solid var(--hairline)',
                  background: dragOver === r.id ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background .12s ease',
                }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      {r.mandatory ? <Chip tone="high" dot>Required</Chip> : <Chip tone="info">Optional</Chip>}
                      <StatusChip status={r.status} />
                      {r.dueDate ? <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>by {fmtDate(r.dueDate)}</span> : null}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.title}</div>
                    {r.description ? (
                      <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.55 }}>{r.description}</div>
                    ) : null}
                    {r.status === 'REJECTED' && r.rejectionNote ? (
                      <div style={{ fontSize: 12.5, color: 'var(--critical)', background: 'var(--critical-soft)', padding: '7px 10px', borderRadius: 'var(--radius-md)', marginTop: 7, lineHeight: 1.5 }}>
                        <strong>Returned:</strong> {r.rejectionNote}
                      </div>
                    ) : null}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ flex: 'none' }} disabled={busy === r.id}
                    onClick={() => { setTarget(r.id); fileInput.current?.click(); }}>
                    {busy === r.id ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="With your advisor" sub={`${inReview.length} being reviewed`} />
          {inReview.length === 0 ? <Empty title="Nothing in review" /> : (
            <div>
              {inReview.map((r, i) => (
                <div key={r.id} style={{ padding: '9px 16px', borderBottom: i === inReview.length - 1 ? 'none' : '1px solid var(--hairline)', display: 'flex', gap: 9, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{r.title}</span>
                  <StatusChip status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Accepted" sub={`${accepted.length} complete`} />
          {accepted.length === 0 ? <Empty title="Nothing accepted yet" /> : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {accepted.map((r, i) => (
                <div key={r.id} style={{ padding: '9px 16px', borderBottom: i === accepted.length - 1 ? 'none' : '1px solid var(--hairline)', display: 'flex', gap: 9, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{r.title}</span>
                  <StatusChip status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
