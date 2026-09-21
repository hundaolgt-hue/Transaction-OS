'use client';

import { useState } from 'react';

/** The fictional sample data room as downloadable PDFs — useful for demos and re-upload testing. */
export default function SampleDataRoom({ docs, company }: { docs: { index: number; code: string | null; title: string }[]; company: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel reveal">
      <button type="button" className="panel-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink)', font: 'inherit', textAlign: 'left' }}>
        <span className="chip chip-medium">Synthetic</span>
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>Sample data room — {company}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{docs.length} fictional source documents the agents analysed, as PDFs. Every page is marked fictional.</span>
        </span>
        <span aria-hidden style={{ transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open ? (
        <div className="panel-body step-in" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))' }}>
          {docs.map((d) => (
            <a key={d.index} href={`/api/dataroom/${d.index}`} className="btn btn-sm lift" style={{ justifyContent: 'flex-start', gap: 8, height: 'auto', padding: '7px 10px' }}>
              <span className="mono" style={{ color: 'var(--ink-faint)', fontSize: 11, minWidth: 44 }}>{d.code ?? '—'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
