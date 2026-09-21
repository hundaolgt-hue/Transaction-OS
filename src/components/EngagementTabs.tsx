'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { seg: '', label: 'Overview' },
  { seg: 'documents', label: 'Documents', count: 'documents' },
  { seg: 'findings', label: 'Findings', count: 'findings' },
  { seg: 'agents', label: 'Agents' },
  { seg: 'reports', label: 'Reports' },
  { seg: 'risks', label: 'Risk register', count: 'risks' },
  { seg: 'prospectus', label: 'Prospectus' },
  { seg: 'contract', label: 'Contract' },
  { seg: 'meetings', label: 'Meetings & tasks', count: 'tasks' },
] as const;

export default function EngagementTabs({ engagementId, counts, outputLabel = 'Prospectus' }: {
  engagementId: string; counts: Record<string, number>; outputLabel?: string;
}) {
  const pathname = usePathname();
  const base = `/engagements/${engagementId}`;

  return (
    <nav style={{ borderBottom: '1px solid var(--hairline)', display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'thin' }}>
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        const n = 'count' in t && t.count ? counts[t.count as string] : undefined;
        const label = t.seg === 'prospectus' ? outputLabel : t.label;
        return (
          <Link key={t.seg} href={href}
            aria-current={active ? 'page' : undefined}
            style={{
              padding: '8px 11px', fontSize: 13, whiteSpace: 'nowrap',
              fontWeight: active ? 600 : 450,
              color: active ? 'var(--ink)' : 'var(--ink-subtle)',
              borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {label}
            {n !== undefined && n > 0 ? (
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: '1px 5px', borderRadius: 99,
                background: 'var(--surface-3)', color: 'var(--ink-subtle)', fontVariantNumeric: 'tabular-nums',
              }}>{n}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
