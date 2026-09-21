'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead } from '@/components/ui';

export default function NewClientForm({ legalForms, sectors }: {
  legalForms: { value: string; label: string }[];
  sectors: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState({
    name: '', legalForm: 'SHARE_COMPANY', sector: 'OTHER', tin: '', businessLicenseNo: '',
    registrationDate: '', paidUpCapital: '', currency: 'ETB', addressLine: '', city: 'Addis Ababa',
    region: '', website: '', primaryContactName: '', primaryContactEmail: '', primaryContactPhone: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, paidUpCapital: f.paidUpCapital ? Number(f.paidUpCapital) : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create the client');
      router.push(`/clients/${json.client.id}`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unexpected error'); setBusy(false); }
  }

  const Field = ({ id, label, type = 'text', hint }: { id: string; label: string; type?: string; hint?: string }) => (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type={type} value={(f as Record<string, string>)[id]} onChange={(e) => set(id, e.target.value)} />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <Panel>
        <PanelHead title="Company" />
        <div className="panel-body" style={{ display: 'grid', gap: 13, gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))' }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="name">Registered name</label>
            <input id="name" className="input" required value={f.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="legalForm">Legal form</label>
            <select id="legalForm" className="select" value={f.legalForm} onChange={(e) => set('legalForm', e.target.value)}>
              {legalForms.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="sector">Sector</label>
            <select id="sector" className="select" value={f.sector} onChange={(e) => set('sector', e.target.value)}>
              {sectors.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <Field id="tin" label="TIN" />
          <Field id="businessLicenseNo" label="Business licence no." />
          <Field id="registrationDate" label="Registration date" type="date" />
          <Field id="paidUpCapital" label="Paid-up capital" type="number" />
          <div className="field">
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" className="select" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {['ETB', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <Field id="website" label="Website" />
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Address and contact" />
        <div className="panel-body" style={{ display: 'grid', gap: 13, gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))' }}>
          <Field id="addressLine" label="Address" />
          <Field id="city" label="City" />
          <Field id="region" label="Region" />
          <Field id="primaryContactName" label="Primary contact" />
          <Field id="primaryContactEmail" label="Contact email" type="email" hint="Used when you later create a portal login." />
          <Field id="primaryContactPhone" label="Contact phone" />
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="notes">Notes</label>
            <textarea id="notes" className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
      </Panel>

      {error ? <div style={{ fontSize: 13, color: 'var(--critical)', background: 'var(--critical-soft)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>{error}</div> : null}
      <div><button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add client'}</button></div>
    </form>
  );
}
