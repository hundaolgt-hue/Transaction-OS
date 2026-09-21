import Link from 'next/link';
import { requireCapability } from '@/lib/auth';
import { listClients, listStaff } from '@/lib/repo/core';
import { RULE_PACKS } from '@/lib/rulepacks';
import { TRANSACTION_TYPES, TRANSACTION_LABEL, type TransactionType } from '@/lib/domain';
import NewEngagementForm from './NewEngagementForm';
import { Empty, Panel } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function NewEngagementPage() {
  const session = await requireCapability('manageEngagement');
  const clients = listClients(session.orgId).filter((c) => c.status !== 'CLOSED');
  const staff = listStaff(session.orgId);

  if (!clients.length) {
    return (
      <Panel>
        <Empty title="Add a client first"
          body="An engagement belongs to a client company. Create the client record, then open the engagement."
          action={<Link className="btn btn-primary btn-sm" href="/clients/new">Add a client</Link>} />
      </Panel>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <header>
        <div className="eyebrow"><Link href="/engagements" style={{ color: 'inherit' }}>Engagements</Link> / New</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Open an engagement</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '4px 0 0', maxWidth: '62ch' }}>
          Choosing a rule pack materialises its document checklist, prospectus skeleton and milestone plan onto the engagement.
        </p>
      </header>
      <NewEngagementForm
        clients={clients.map((c) => ({ id: c.id, name: c.name, sector: c.sector }))}
        staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))}
        packs={RULE_PACKS.map((p) => ({
          key: p.key, name: p.name, version: p.version, description: p.description,
          transactionTypes: p.transactionTypes, requirements: p.requirements.length,
          sections: p.prospectus.length, rules: p.rules.length,
        }))}
        transactionTypes={TRANSACTION_TYPES.map((t) => ({ value: t, label: TRANSACTION_LABEL[t as TransactionType] }))}
      />
    </div>
  );
}
