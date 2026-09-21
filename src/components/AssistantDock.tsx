'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { renderMarkdown } from '@/lib/markdown';

interface Msg { role: 'me' | 'ai'; text: string; sources?: { title: string; link: string }[]; engine?: string }

const STAFF_SUGGESTIONS = [
  'Summarise all projects',
  'What documents are missing for Abyssinia?',
  'Any critical findings on the bond?',
  'How much is outstanding in fees?',
  'What is the gearing covenant on the IPO?',
  'Which milestones are overdue?',
];
const CLIENT_SUGGESTIONS = [
  'What documents do you still need from us?',
  'Where does our transaction stand?',
  'When is the next milestone?',
];

/** Floating "Ask Advisor OS" chat, available on every page. */
export default function AssistantDock({ audience, inline = false }: { audience: 'staff' | 'client'; inline?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(inline);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape' && !inline) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: 'me', text: question }]);
    setText('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'The assistant could not answer');
      setMsgs((m) => [...m, { role: 'ai', text: j.text, sources: j.sources, engine: j.engine }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e instanceof Error ? e.message : 'Something went wrong.' }]);
    } finally { setBusy(false); }
  }

  const suggestions = audience === 'client' ? CLIENT_SUGGESTIONS : STAFF_SUGGESTIONS;

  const panel = (
    <section className={inline ? 'panel' : 'panel dock'} style={inline ? { display: 'flex', flexDirection: 'column', height: 'min(72dvh, 720px)' } : undefined} aria-label="Assistant">
      <div className="panel-head" style={{ padding: '11px 14px' }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          <span className="pulse-dot" />
          <div>
            <div className="panel-title">Ask Advisor OS</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{audience === 'client' ? 'About your transaction' : 'Answers from every engagement, document and finding'}</div>
          </div>
        </div>
        {!inline ? <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close assistant">✕</button> : null}
      </div>
      <div className="msgs">
        {msgs.length === 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: 0, lineHeight: 1.6 }}>
              Ask in plain language. I answer from the live records and link you to the source.
            </p>
            <div className="suggest">{suggestions.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        ) : msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'ai' ? (
              <>
                <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                {m.sources?.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {m.sources.slice(0, 4).map((s, k) => (
                      <Link key={k} href={s.link} onClick={() => !inline && setOpen(false)} className="chip chip-neutral" style={{ height: 'auto', padding: '3px 8px', whiteSpace: 'normal' }}>↗ {s.title}</Link>
                    ))}
                  </div>
                ) : null}
                {m.engine ? <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 6 }}>{m.engine === 'anthropic' ? 'Answered by Claude over the records' : 'Answered from the records'}</div> : null}
              </>
            ) : m.text}
          </div>
        ))}
        {busy ? <div className="msg ai typing" aria-label="Thinking"><span /><span /><span /></div> : null}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(text); }} style={{ borderTop: '1px solid var(--hairline)', padding: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label htmlFor={inline ? 'assistant-q-inline' : 'assistant-q'} className="sr-only" style={{ position: 'absolute', left: -9999 }}>Question</label>
        <textarea id={inline ? 'assistant-q-inline' : 'assistant-q'} ref={input} className="textarea" rows={1} style={{ minHeight: 38, maxHeight: 120 }}
          placeholder="Ask about any client, document, finding or fee…" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
        <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>Ask</button>
      </form>
    </section>
  );

  if (inline) return panel;
  if (pathname === '/assistant') return null; // the full-page assistant is already open
  return (
    <>
      {open ? panel : null}
      <button className="dock-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Ask Advisor OS">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
        {open ? 'Close' : 'Ask'}
        <span style={{ fontSize: 10.5, opacity: 0.75, fontWeight: 500 }}>⌘K</span>
      </button>
    </>
  );
}
