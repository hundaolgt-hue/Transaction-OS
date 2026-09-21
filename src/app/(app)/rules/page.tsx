import { requireStaff } from '@/lib/auth';
import { RULE_PACKS } from '@/lib/rulepacks';
import RulePackBrowser from '@/components/RulePackBrowser';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  await requireStaff();
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow">Regulatory library</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Rule packs</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '4px 0 0', maxWidth: '76ch' }}>
          A rule pack is the firm&apos;s codified view of what a transaction requires: the document checklist, the tests each
          document must pass, the prospectus contents and the milestone plan. Engagements are pinned to a pack version, so a
          later amendment never silently changes a file that is already under review.
        </p>
      </header>
      <RulePackBrowser packs={RULE_PACKS.map((p) => ({
        key: p.key, name: p.name, version: p.version, authority: p.authority,
        description: p.description, disclaimer: p.disclaimer, transactionTypes: p.transactionTypes,
        requirements: p.requirements, rules: p.rules, prospectus: p.prospectus, milestones: p.milestones,
      }))} />
    </div>
  );
}
