'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead } from '@/components/ui';

interface PackInfo {
  key: string; name: string; version: string; description: string;
  transactionTypes: string[]; requirements: number; sections: number; rules: number;
}

export default function NewEngagementForm({ clients, staff, packs, transactionTypes }: {
  clients: { id: string; name: string; sector: string }[];
  staff: { id: string; name: string; role: string }[];
  packs: PackInfo[];
  transactionTypes: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? '',
    name: '',
    transactionType: 'IPO',
    targetRaise: '',
    currency: 'ETB',
    targetFilingDate: '',
    leadAdvisorId: staff[0]?.id ?? '',
    documentThreshold: '80',
    description: '',
    createContract: true,
    totalFee: '',
    contractTitle: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack = useMemo(
    () => packs.find((p) => p.transactionTypes.includes(form.transactionType)) ?? packs[0],
    [packs, form.transactionType],
  );

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/engagements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          targetRaise: form.targetRaise ? Number(form.targetRaise) : null,
          documentThreshold: Number(form.documentThreshold),
          totalFee: form.totalFee ? Number(form.totalFee) : 0,
          rulePackKey: pack?.key,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create the engagement');
      router.push(`/engagements/${json.engagement.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <Panel>
        <PanelHead title="Mandate" />
        <div className="panel-body" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))' }}>
          <div className="field">
            <label className="label" htmlFor="clientId">Client</label>
            <select id="clientId" className="select" value={form.clientId} onChange={(e) => set('clientId', e.target.value)} required>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="transactionType">Transaction type</label>
            <select id="transactionType" className="select" value={form.transactionType} onChange={(e) => set('transactionType', e.target.value)}>
              {transactionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="name">Engagement name</label>
            <input id="name" className="input" required placeholder="e.g. Initial public offering of 2.5m ordinary shares"
              value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="targetRaise">Target raise</label>
            <input id="targetRaise" className="input" type="number" min="0" step="1000" placeholder="500000000"
              value={form.targetRaise} onChange={(e) => set('targetRaise', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" className="select" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {['ETB', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="targetFilingDate">Target filing date</label>
            <input id="targetFilingDate" className="input" type="date" value={form.targetFilingDate} onChange={(e) => set('targetFilingDate', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="leadAdvisorId">Lead advisor</label>
            <select id="leadAdvisorId" className="select" value={form.leadAdvisorId} onChange={(e) => set('leadAdvisorId', e.target.value)}>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="documentThreshold">Document threshold</label>
            <input id="documentThreshold" className="input" type="number" min="0" max="100"
              value={form.documentThreshold} onChange={(e) => set('documentThreshold', e.target.value)} />
            <span className="hint">Completeness required before the engagement may advance a stage.</span>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="description">Scope note</label>
            <textarea id="description" className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="What the firm is engaged to do, and any carve-outs." />
          </div>
        </div>
      </Panel>

      {pack ? (
        <Panel>
          <PanelHead title="Rule pack" sub={`Selected automatically from the transaction type`} />
          <div className="panel-body">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>{pack.name}</strong>
              <span className="mono" style={{ color: 'var(--ink-faint)' }}>{pack.key} v{pack.version}</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '6px 0 12px', lineHeight: 1.6 }}>{pack.description}</p>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {[['Document requirements', pack.requirements], ['Compliance rules', pack.rules], ['Prospectus sections', pack.sections]].map(([l, v]) => (
                <div key={String(l)}>
                  <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v as number}</div>
                  <div className="eyebrow">{l as string}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHead title="Contract"
          actions={
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-subtle)' }}>
              <input type="checkbox" checked={form.createContract} onChange={(e) => set('createContract', e.target.checked)} />
              Create now
            </label>
          } />
        {form.createContract ? (
          <div className="panel-body" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="contractTitle">Contract title</label>
              <input id="contractTitle" className="input" placeholder="Transaction advisory services agreement"
                value={form.contractTitle} onChange={(e) => set('contractTitle', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="totalFee">Total fee ({form.currency})</label>
              <input id="totalFee" className="input" type="number" min="0" step="1000" placeholder="4500000"
                value={form.totalFee} onChange={(e) => set('totalFee', e.target.value)} />
              <span className="hint">Split across the rule pack&apos;s milestone plan.</span>
            </div>
          </div>
        ) : (
          <div className="panel-body"><p className="hint" style={{ margin: 0 }}>You can add the contract and its milestones later from the engagement.</p></div>
        )}
      </Panel>

      {error ? (
        <div role="alert" style={{ fontSize: 13, color: 'var(--critical)', background: 'var(--critical-soft)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Open engagement'}
        </button>
      </div>
    </form>
  );
}
