'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Chip, StatusChip, Empty, Stat, Grid } from '@/components/ui';
import { RISK_CATEGORIES, riskBand, titleCase } from '@/lib/domain';
import type { Risk } from '@/lib/types';

export default function RiskRegister({ engagementId, risks }: { engagementId: string; risks: Risk[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'LEGAL', description: '', likelihood: 3, impact: 3, mitigation: '' });

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/risks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(null); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy('new');
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/risks`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, likelihood: Number(form.likelihood), impact: Number(form.impact) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not add the risk');
      setAdding(false);
      setForm({ title: '', category: 'LEGAL', description: '', likelihood: 3, impact: 3, mitigation: '' });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add the risk'); }
    finally { setBusy(null); }
  }

  const high = risks.filter((r) => r.inherentScore >= 15).length;
  const openRisks = risks.filter((r) => r.status === 'OPEN').length;
  const avgResidual = risks.length ? Math.round((risks.reduce((a, r) => a + r.residualScore, 0) / risks.length) * 10) / 10 : 0;

  // 5×5 heat map of inherent scores.
  const matrix = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, l) =>
    risks.filter((r) => r.impact === 5 - i && r.likelihood === l + 1)));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Grid min={180}>
        <Stat label="Risks on register" value={risks.length} />
        <Stat label="High inherent" value={high} tone={high ? 'critical' : 'good'} sub="Score 15 or above" />
        <Stat label="Open" value={openRisks} tone={openRisks ? 'medium' : 'good'} sub="Not yet mitigated, accepted or closed" />
        <Stat label="Avg. residual score" value={avgResidual} tone={avgResidual >= 9 ? 'high' : 'good'} sub="After stated mitigation" />
      </Grid>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="Inherent risk heat map" sub="Impact (vertical) against likelihood (horizontal)" />
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: 3, fontSize: 11 }}>
              {matrix.map((row, i) => (
                <Fragment key={`row-${i}`}>
                  <div style={{ color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5 }}>{5 - i}</div>
                  {row.map((cell, j) => {
                    const score = (5 - i) * (j + 1);
                    const band = riskBand(score);
                    const bg = cell.length
                      ? `var(--${band.tone === 'critical' ? 'critical' : band.tone === 'high' ? 'high' : band.tone === 'medium' ? 'medium' : 'good'})`
                      : 'var(--surface-2)';
                    return (
                      <div key={`${i}-${j}`} title={cell.map((c) => c.title).join('\n') || `Score ${score}`}
                        style={{
                          aspectRatio: '1', borderRadius: 'var(--radius-xs)', background: bg,
                          opacity: cell.length ? 0.9 : 0.35,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, color: cell.length ? '#fff' : 'var(--ink-faint)',
                        }}>
                        {cell.length || ''}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
              <div />
              {[1, 2, 3, 4, 5].map((l) => <div key={`b${l}`} style={{ textAlign: 'center', color: 'var(--ink-faint)', paddingTop: 3 }}>{l}</div>)}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Add a risk" actions={<button className="btn btn-sm" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : 'New risk'}</button>} />
          {adding ? (
            <form onSubmit={create} className="panel-body" style={{ display: 'grid', gap: 11 }}>
              <div className="field">
                <label className="label">Title</label>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                <div className="field">
                  <label className="label">Category</label>
                  <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Likelihood</label>
                  <select className="select" value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Impact</label>
                  <select className="select" value={form.impact} onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">Description</label>
                <textarea className="textarea" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Mitigation</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy === 'new'}>{busy === 'new' ? 'Adding…' : 'Add to register'}</button>
            </form>
          ) : (
            <div className="panel-body">
              <p className="hint" style={{ margin: 0 }}>
                The Risk Agent derives risks from the legal and financial findings and sets a disclosure strategy for each.
                Add one manually where a risk arises outside the document review.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {error ? <div style={{ fontSize: 12.5, color: 'var(--critical)', padding: '9px 12px', background: 'var(--critical-soft)', borderRadius: 'var(--radius-md)' }}>{error}</div> : null}

      <Panel>
        <PanelHead title="Risk register" sub={`${risks.length} risk${risks.length === 1 ? '' : 's'}`} />
        {risks.length === 0 ? (
          <Empty title="The register is empty" body="Run the Risk Agent after the legal and financial reviews, or add a risk manually." />
        ) : (
          <div>
            {risks.map((r, i) => {
              const band = riskBand(r.inherentScore);
              const isOpen = open === r.id;
              return (
                <div key={r.id} style={{ borderBottom: i === risks.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                  <button onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '11px 16px', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="mono" style={{ color: 'var(--ink-faint)' }}>{r.code}</span>
                      <Chip tone={band.tone}>{band.label} · {r.inherentScore}</Chip>
                      <Chip tone="neutral">{titleCase(r.category)}</Chip>
                      <StatusChip status={r.status} />
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
                        L{r.likelihood} × I{r.impact} → residual {r.residualScore}
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.title}</div>
                  </button>

                  {isOpen ? (
                    <div className="fade-up" style={{ padding: '0 16px 16px', display: 'grid', gap: 12 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{r.description}</div>
                      {r.mitigation ? (
                        <div><div className="eyebrow" style={{ marginBottom: 4 }}>Mitigation</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>{r.mitigation}</div></div>
                      ) : null}
                      {r.disclosureStrategy ? (
                        <div><div className="eyebrow" style={{ marginBottom: 4 }}>Disclosure strategy</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>{r.disclosureStrategy}</div>
                          {r.prospectusPlacement ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>Placement: {r.prospectusPlacement}</div> : null}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                        {(['likelihood', 'impact', 'residualLikelihood', 'residualImpact'] as const).map((k) => (
                          <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span className="label">{titleCase(k)}</span>
                            <select className="select" style={{ width: 70 }} value={r[k]} disabled={busy === r.id}
                              onChange={(e) => patch(r.id, { [k]: Number(e.target.value) })}>
                              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        ))}
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span className="label">Status</span>
                          <select className="select" style={{ width: 130 }} value={r.status} disabled={busy === r.id}
                            onChange={(e) => patch(r.id, { status: e.target.value })}>
                            {['OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                          </select>
                        </label>
                      </div>
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
