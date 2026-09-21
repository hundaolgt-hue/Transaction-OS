'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GraphView } from '@/lib/knowledge/view';
import { NODE_META, type Graph, type GNode, type NodeType } from '@/lib/knowledge/graph';

/** Interactive map of the whole operation: drag, zoom, filter, search, click for detail. */
export default function KnowledgeGraph({ graph, height = 520, compact = false }: { graph: Graph; height?: number; compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<GraphView | null>(null);
  const [sel, setSel] = useState<{ node: GNode; nb: GNode[] } | null>(null);
  const [hidden, setHidden] = useState<NodeType[]>(compact ? ['DOCUMENT'] : []);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!canvas.current) return;
    const v = new GraphView(canvas.current, graph, {
      onSelect: (node, nb) => setSel(node ? { node, nb } : null),
      dark: () => document.documentElement.getAttribute('data-theme') !== 'light',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    view.current = v;
    v.setHidden(hidden);
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  useEffect(() => { view.current?.setHidden(hidden); }, [hidden]);
  useEffect(() => { const t = setTimeout(() => view.current?.setQuery(q), 250); return () => clearTimeout(t); }, [q]);

  const toggle = (t: NodeType) => setHidden((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]));

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="graph-legend" role="group" aria-label="Show or hide node types">
          {(Object.keys(NODE_META) as NodeType[]).filter((t) => graph.counts[t]).map((t) => (
            <button key={t} aria-pressed={!hidden.includes(t)} onClick={() => toggle(t)}>
              <i style={{ background: NODE_META[t].color }} />{NODE_META[t].label}
              <span style={{ color: 'var(--ink-faint)' }}>{graph.counts[t]}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <label htmlFor="graph-search" style={{ position: 'absolute', left: -9999 }}>Search the graph</label>
        <input id="graph-search" className="input" style={{ width: 200 }} placeholder="Find a node…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-sm" onClick={() => { setQ(''); view.current?.reset(); }}>Reset view</button>
      </div>
      <div className="graph-wrap" style={{ height }}>
        <canvas ref={canvas} tabIndex={0} aria-label="Knowledge graph of the operation. Drag to move, scroll to zoom, click a node for details." />
        {sel ? (
          <div className="panel graph-card fade-up" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 4 }}>
                <i style={{ width: 9, height: 9, borderRadius: 99, background: NODE_META[sel.node.type].color }} />
                <span className="eyebrow">{NODE_META[sel.node.type].label}</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setSel(null); view.current?.reset(); }} aria-label="Close">✕</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{sel.node.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{sel.node.sub}</div>
            </div>
            <dl style={{ margin: 0, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', fontSize: 12 }}>
              {sel.node.detail.map(([k, v]) => (<Fragment key={k}><dt style={{ color: 'var(--ink-faint)' }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>))}
            </dl>
            <div style={{ padding: '8px 14px 12px' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Connected to {sel.nb.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sel.nb.slice(0, 14).map((n) => (
                  <button key={n.id} className="chip chip-neutral" style={{ cursor: 'pointer', border: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => view.current?.focus(n.id)}>
                    <i className="chip-dot" style={{ color: NODE_META[n.type].color }} />{n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
                  </button>
                ))}
              </div>
              {sel.node.link ? <Link className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%' }} href={sel.node.link}>Open</Link> : null}
            </div>
          </div>
        ) : (
          <div style={{ position: 'absolute', left: 12, bottom: 10, fontSize: 11.5, color: 'var(--ink-faint)', pointerEvents: 'none' }}>
            Drag nodes · scroll to zoom · click for details · pulsing nodes are critical
          </div>
        )}
      </div>
    </div>
  );
}
