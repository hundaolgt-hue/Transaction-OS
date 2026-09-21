import Link from 'next/link';
import { requireCapability } from '@/lib/auth';
import { LEGAL_FORMS, LEGAL_FORM_LABEL, SECTORS, titleCase } from '@/lib/domain';
import NewClientForm from './NewClientForm';

export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  await requireCapability('manageClients');
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <header>
        <div className="eyebrow"><Link href="/clients" style={{ color: 'inherit' }}>Clients</Link> / New</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Add a client</h1>
      </header>
      <NewClientForm
        legalForms={LEGAL_FORMS.map((f) => ({ value: f, label: LEGAL_FORM_LABEL[f] ?? f }))}
        sectors={SECTORS.map((s) => ({ value: s, label: titleCase(s) }))}
      />
    </div>
  );
}
