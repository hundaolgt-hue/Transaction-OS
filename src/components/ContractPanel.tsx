'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Stat, Grid, StatusChip, Empty, Defs, Meter } from '@/components/ui';
import { fmtMoney, fmtDate, titleCase } from '@/lib/domain';
import type { Contract, Milestone } from '@/lib/types';

export default function ContractPanel({ engagementId, clientName, currency, contract, milestones, fees, canManage }: {
  engagementId: string; clientName: string; currency: string;
  contract: Contract | null; milestones: Milestone[];
  fees: { billed: number; paid: number; outstanding: number; unbilled: number; milestonesDone: number; milestonesTotal: number; percentComplete: number; percentPaid: number };
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: `Transaction advisory services agreement — ${clientName}`,
    totalFee: '', feeModel: 'FIXED', scopeSummary: '', signedDate: '',
  });

  async function createContract(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create');
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/contract`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, totalFee: Number(form.totalFee || 0), currency }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create the contract');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the contract'); }
    finally { setBusy(null); }
  }

  async function patchContract(body: Record<string, unknown>) {
    setBusy('contract');
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/contract`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Update failed');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(null); }
  }

  async function patchMilestone(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Update failed');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(null); }
  }

  if (!contract) {
    return (
      <Panel>
        <PanelHead title="No contract on this engagement" sub="Creating one generates the milestone and fee plan from the rule pack" />
        {canManage ? (
          <form onSubmit={createContract} className="panel-body" style={{ display: 'grid', gap: 13, maxWidth: 520 }}>
            <div className="field">
              <label className="label">Title</label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gap: 13, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <div className="field">
                <label className="label">Total fee ({currency})</label>
                <input className="input" type="number" min="0" required value={form.totalFee} onChange={(e) => setForm({ ...form, totalFee: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Fee model</label>
                <select className="select" value={form.feeModel} onChange={(e) => setForm({ ...form, feeModel: e.target.value })}>
                  {['FIXED', 'RETAINER', 'SUCCESS', 'HYBRID'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Signed date</label>
                <input className="input" type="date" value={form.signedDate} onChange={(e) => setForm({ ...form, signedDate: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="label">Scope summary</label>
              <textarea className="textarea" value={form.scopeSummary} onChange={(e) => setForm({ ...form, scopeSummary: e.target.value })} />
            </div>
            {error ? <div style={{ fontSize: 12.5, color: 'var(--critical)' }}>{error}</div> : null}
            <button className="btn btn-primary" type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create contract'}</button>
          </form>
        ) : <Empty title="No contract" body="Ask the lead advisor or managing partner to create it." />}
      </Panel>
    );
  }

  const vat = contract.totalFee * (contract.vatPercent / 100);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Grid min={180}>
        <Stat label="Total fee" value={fmtMoney(contract.totalFee, contract.currency)} sub={`plus ${contract.vatPercent}% VAT = ${fmtMoney(contract.totalFee + vat, contract.currency)}`} />
        <Stat label="Received" value={fmtMoney(fees.paid, contract.currency)} tone="good" sub={`${fees.percentPaid}% of the fee`} />
        <Stat label="Outstanding" value={fmtMoney(fees.outstanding, contract.currency)} tone={fees.outstanding ? 'high' : 'good'} sub="Invoiced, unpaid" />
        <Stat label="Not yet billed" value={fmtMoney(fees.unbilled, contract.currency)} sub="Future milestones" />
        <Stat label="Milestones complete" value={`${fees.milestonesDone}/${fees.milestonesTotal}`} sub={`${fees.percentComplete}% of the plan`} />
      </Grid>

      {error ? <div style={{ fontSize: 12.5, color: 'var(--critical)', padding: '9px 12px', background: 'var(--critical-soft)', borderRadius: 'var(--radius-md)' }}>{error}</div> : null}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title={contract.title}
            actions={canManage ? (
              <select className="select btn-sm" style={{ width: 'auto', height: 26, padding: '0 24px 0 8px', fontSize: 12 }}
                value={contract.status} disabled={busy === 'contract'} onChange={(e) => patchContract({ status: e.target.value })}>
                {['DRAFT', 'SENT', 'SIGNED', 'COMPLETED', 'TERMINATED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            ) : <StatusChip status={contract.status} />} />
          <div className="panel-body">
            <Defs items={[
              ['Status', <StatusChip key="s" status={contract.status} />],
              ['Fee model', titleCase(contract.feeModel)],
              ['Total fee', fmtMoney(contract.totalFee, contract.currency)],
              ['VAT', `${contract.vatPercent}% — ${fmtMoney(vat, contract.currency)}`],
              ['Signed', fmtDate(contract.signedDate)],
              ['Effective', fmtDate(contract.effectiveDate)],
              ['Ends', fmtDate(contract.endDate)],
            ]} />
            {contract.scopeSummary ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--hairline)', lineHeight: 1.6 }}>
                {contract.scopeSummary}
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Fee collection" />
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            <Meter value={fees.percentPaid} label="Fee received" />
            <Meter value={fees.percentComplete} label="Milestones complete" />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Milestones and payments" sub={`${milestones.length} milestone${milestones.length === 1 ? '' : 's'}`} />
        {milestones.length === 0 ? <Empty title="No milestones" /> : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th>#</th><th>Milestone</th><th>Due</th><th>Status</th><th className="num">Fee</th><th>Payment</th></tr>
              </thead>
              <tbody>
                {milestones.map((m) => {
                  const overdue = m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate) < new Date();
                  return (
                    <tr key={m.id}>
                      <td className="mono" style={{ color: 'var(--ink-faint)' }}>{m.sequence}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        {m.description ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{m.description}</div> : null}
                        {m.invoiceNo ? <div className="mono" style={{ color: 'var(--ink-faint)', marginTop: 2 }}>Invoice {m.invoiceNo}</div> : null}
                      </td>
                      <td style={{ fontSize: 12.5, color: overdue ? 'var(--critical)' : 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(m.dueDate)}{overdue ? ' · overdue' : ''}
                      </td>
                      <td>
                        {canManage ? (
                          <select className="select" style={{ width: 'auto', fontSize: 12 }} value={m.status} disabled={busy === m.id}
                            onChange={(e) => patchMilestone(m.id, { status: e.target.value })}>
                            {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                          </select>
                        ) : <StatusChip status={m.status} />}
                      </td>
                      <td className="num mono">{fmtMoney(m.paymentAmount, contract.currency)}</td>
                      <td>
                        {canManage ? (
                          <select className="select" style={{ width: 'auto', fontSize: 12 }} value={m.paymentStatus} disabled={busy === m.id}
                            onChange={(e) => patchMilestone(m.id, { paymentStatus: e.target.value })}>
                            {['UNBILLED', 'INVOICED', 'PAID', 'WAIVED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                          </select>
                        ) : <StatusChip status={m.paymentStatus} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
