'use client';

import { useState } from 'react';

export interface PdfItem { key: string; title: string; sub: string; href: string; fileName: string }

/** Download cards for server-rendered PDFs, with a progress state (rendering 30–50 pages takes a few seconds). */
export default function PdfDownloads({ items, title = 'PDF outputs', sub }: { items: PdfItem[]; title?: string; sub?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, string>>({});

  async function get(it: PdfItem) {
    setBusy(it.key);
    try {
      const res = await fetch(it.href);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const pages = res.headers.get('x-page-count');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = it.fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setInfo((m) => ({ ...m, [it.key]: `${pages ? `${pages} pages · ` : ''}${(blob.size / 1024).toFixed(0)} KB` }));
    } catch (e) {
      setInfo((m) => ({ ...m, [it.key]: `Failed: ${(e as Error).message}` }));
    }
    setBusy(null);
  }

  return (
    <div className="panel reveal">
      <div className="panel-head">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {sub ? <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{sub}</div> : null}
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        {items.map((it) => (
          <button key={it.key} type="button" className="pdf-card lift" onClick={() => get(it)} disabled={busy !== null} aria-busy={busy === it.key}>
            <span className="pdf-ico" aria-hidden>{busy === it.key ? <span className="spinner" /> : 'PDF'}</span>
            <span style={{ display: 'grid', gap: 2, textAlign: 'left', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{it.title}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{busy === it.key ? 'Rendering…' : info[it.key] ?? it.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
