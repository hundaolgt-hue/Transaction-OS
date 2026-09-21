'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, STAGE_META, type Stage } from '@/lib/domain';

interface Gate { canAdvance: boolean; nextStage: string | null; blockers: string[]; completeness: number; threshold: number }

export default function StageControl({ engagementId, stage, gate, canAdvance }: {
  engagementId: string; stage: string; gate: Gate; canAdvance: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idx = STAGES.indexOf(stage as Stage);

  async function advance(force = false) {
    if (!gate.nextStage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/stage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toStage: gate.nextStage, force, note: force ? 'Advanced with an override by the lead advisor.' : 'Stage gate satisfied.' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not advance the stage');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minWidth: 260, flex: '0 1 340px' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
        {STAGES.map((st, i) => (
          <div key={st} title={STAGE_META[st].label}
            style={{
              flex: 1, height: 4, borderRadius: 99,
              background: i < idx ? 'var(--accent)' : i === idx ? 'var(--accent-hover)' : 'var(--surface-3)',
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
          Stage {idx + 1} of {STAGES.length}
          {gate.nextStage ? ` · next: ${STAGE_META[gate.nextStage as Stage].label}` : ' · final stage'}
        </div>
        {canAdvance && gate.nextStage ? (
          <button className={`btn btn-sm ${gate.canAdvance ? 'btn-primary' : ''}`} onClick={() => (gate.canAdvance ? advance(false) : setOpen((v) => !v))} disabled={busy}>
            {busy ? 'Working…' : gate.canAdvance ? 'Advance stage' : 'Blocked'}
          </button>
        ) : null}
      </div>

      {open && !gate.canAdvance ? (
        <div className="panel fade-up" style={{ marginTop: 8, padding: 12, boxShadow: 'var(--shadow-md)' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Stage gate blocked</div>
          <ul style={{ margin: '0 0 10px', paddingLeft: 16, fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            {gate.blockers.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          {error ? <div style={{ fontSize: 12, color: 'var(--critical)', marginBottom: 8 }}>{error}</div> : null}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-danger" onClick={() => advance(true)} disabled={busy}>Override and advance</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <p className="hint" style={{ margin: '8px 0 0' }}>An override is recorded in the audit trail against your name.</p>
        </div>
      ) : null}
    </div>
  );
}
