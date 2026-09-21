'use client';

import { useState } from 'react';
import { Panel, PanelHead, Chip, SeverityChip, Stat, Grid } from '@/components/ui';
import { TRANSACTION_LABEL, GAP_LABEL, titleCase, type TransactionType, type GapType } from '@/lib/domain';
import type { RequirementSpec, RuleSpec, ProspectusSectionSpec, MilestoneSpec } from '@/lib/rulepacks';

interface PackView {
  key: string; name: string; version: string; authority: string; description: string; disclaimer: string;
  transactionTypes: string[]; requirements: RequirementSpec[]; rules: RuleSpec[];
  prospectus: ProspectusSectionSpec[]; milestones: MilestoneSpec[];
}

const TABS = ['requirements', 'rules', 'prospectus', 'milestones'] as const;

export default function RulePackBrowser({ packs }: { packs: PackView[] }) {
  const [activeKey, setActiveKey] = useState(packs[0]?.key ?? '');
  const [tab, setTab] = useState<(typeof TABS)[number]>('requirements');
  const [query, setQuery] = useState('');
  const pack = packs.find((p) => p.key === activeKey) ?? packs[0];
  if (!pack) return null;

  const q = query.toLowerCase();
  const reqs = pack.requirements.filter((r) => !q || `${r.code} ${r.title} ${r.description} ${r.authorityRef}`.toLowerCase().includes(q));
  const rules = pack.rules.filter((r) => !q || `${r.id} ${r.title} ${r.detail} ${r.citation}`.toLowerCase().includes(q));
  const sections = pack.prospectus.filter((s) => !q || `${s.code} ${s.heading} ${s.guidance}`.toLowerCase().includes(q));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {packs.map((p) => (
          <button key={p.key} className={`btn ${p.key === pack.key ? 'btn-primary' : ''}`} onClick={() => setActiveKey(p.key)}>
            {p.name}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHead title={pack.name} sub={`${pack.key} · version ${pack.version} · ${pack.authority}`} />
        <div className="panel-body">
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>{pack.description}</p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {pack.transactionTypes.map((t) => <Chip key={t} tone="neutral">{TRANSACTION_LABEL[t as TransactionType] ?? t}</Chip>)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', background: 'var(--high-soft)', padding: '10px 12px', borderRadius: 'var(--radius-md)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--high)' }}>Verify before filing.</strong> {pack.disclaimer}
          </div>
        </div>
      </Panel>

      <Grid min={175}>
        <Stat label="Document requirements" value={pack.requirements.length} sub={`${pack.requirements.filter((r) => r.mandatory).length} mandatory`} />
        <Stat label="Compliance rules" value={pack.rules.length} sub={`${pack.rules.filter((r) => r.severity === 'CRITICAL').length} critical`} />
        <Stat label="Prospectus sections" value={pack.prospectus.length} />
        <Stat label="Milestones" value={pack.milestones.length} />
      </Grid>

      <Panel>
        <div className="panel-head" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 2, borderRadius: 'var(--radius-md)' }}>
            {TABS.map((t) => (
              <button key={t} className="btn btn-sm btn-ghost" onClick={() => setTab(t)}
                style={{ background: tab === t ? 'var(--surface-1)' : 'transparent', color: tab === t ? 'var(--ink)' : undefined }}>
                {titleCase(t)}
              </button>
            ))}
          </div>
          <input className="input" style={{ width: 'auto', flex: '1 1 180px', minWidth: 140 }} placeholder="Search the pack…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="table-scroll">
          {tab === 'requirements' ? (
            <table className="data">
              <thead><tr><th>Code</th><th>Requirement</th><th>Category</th><th className="num">Weight</th><th>Stage</th><th>Authority</th></tr></thead>
              <tbody>
                {reqs.map((r) => (
                  <tr key={r.code}>
                    <td className="mono" style={{ color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{r.code}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.title} {r.mandatory ? null : <Chip tone="info">Optional</Chip>}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2, lineHeight: 1.5 }}>{r.description}</div>
                    </td>
                    <td><Chip tone="neutral">{titleCase(r.category)}</Chip></td>
                    <td className="num mono">{r.weight}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{titleCase(r.appliesToStage)}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--ink-faint)', maxWidth: 230 }}>{r.authorityRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'rules' ? (
            <table className="data">
              <thead><tr><th>ID</th><th>Test</th><th>Agent</th><th>Type</th><th>Severity</th><th>Applies to</th></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ color: 'var(--ink-faint)' }}>{r.id}</td>
                    <td style={{ maxWidth: 480 }}>
                      <div style={{ fontWeight: 500 }}>{r.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2, lineHeight: 1.5 }}>{r.detail}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 4 }}><strong>Authority:</strong> {r.citation}</div>
                      {r.phrases?.length ? (
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                          {r.kind.replace(/_/g, ' ').toLowerCase()}: {r.phrases.map((p) => `“${p}”`).join(', ')}
                        </div>
                      ) : null}
                    </td>
                    <td><Chip tone="neutral">{titleCase(r.agent)}</Chip></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{GAP_LABEL[r.gapType as GapType] ?? r.gapType}</td>
                    <td><SeverityChip severity={r.severity} /></td>
                    <td className="mono" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{r.appliesTo.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'prospectus' ? (
            <table className="data">
              <thead><tr><th>Code</th><th>Section</th><th className="num">Min words</th><th>Required by</th><th>Sources</th></tr></thead>
              <tbody>
                {sections.map((s) => (
                  <tr key={s.code}>
                    <td className="mono" style={{ color: 'var(--ink-faint)' }}>{s.code}</td>
                    <td style={{ maxWidth: 480 }}>
                      <div style={{ fontWeight: 500 }}>{s.heading}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2, lineHeight: 1.5 }}>{s.guidance}</div>
                    </td>
                    <td className="num mono">{s.minWords}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--ink-faint)', maxWidth: 220 }}>{s.requiredBy}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{s.sourceRequirements.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data">
              <thead><tr><th className="num">#</th><th>Milestone</th><th className="num">Day</th><th className="num">Fee share</th></tr></thead>
              <tbody>
                {pack.milestones.map((m) => (
                  <tr key={m.name}>
                    <td className="num mono">{m.sequence}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{m.description}</div>
                    </td>
                    <td className="num mono">+{m.offsetDays}</td>
                    <td className="num mono">{Math.round(m.feeShare * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
