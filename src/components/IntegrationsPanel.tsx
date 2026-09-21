'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type View = {
  enabled: boolean; minSeverity: string; lastDeliveryAt: string | null; lastError: string | null; deliveries: number;
  config: Record<string, string | boolean>; webhook: string;
} | null;

const FIELDS = {
  TELEGRAM: [
    { key: 'botToken', label: 'Bot token', hint: 'From @BotFather. Stored server-side; shown masked.', secret: true },
    { key: 'chatId', label: 'Chat ID', hint: 'Group or channel ID, e.g. -1001234567890. Add the bot to the group first.' },
  ],
  SLACK: [
    { key: 'webhookUrl', label: 'Incoming webhook URL', hint: 'Slack app → Incoming Webhooks → Add to channel.', secret: true },
    { key: 'signingSecret', label: 'Signing secret', hint: 'Needed for the /advisor slash command. Basic Information → App credentials.', secret: true },
    { key: 'channel', label: 'Channel label', hint: 'For display only, e.g. #deal-team.' },
  ],
} as const;

export default function IntegrationsPanel({ initial, canManage }: { initial: { TELEGRAM: View; SLACK: View }; canManage: boolean }) {
  const [views, setViews] = useState(initial);
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))' }}>
      <Card kind="TELEGRAM" title="Telegram" view={views.TELEGRAM} canManage={canManage} onChange={setViews}
        blurb="Push compliance gaps, missing documents and agent completions to a Telegram group. Members can ask the bot questions about any engagement with /ask." />
      <Card kind="SLACK" title="Slack" view={views.SLACK} canManage={canManage} onChange={setViews}
        blurb="Post alerts to a Slack channel through an incoming webhook, and answer /advisor slash commands with portfolio and engagement briefs." />
    </div>
  );
}

function Card({ kind, title, view, blurb, canManage, onChange }: {
  kind: 'TELEGRAM' | 'SLACK'; title: string; view: View; blurb: string; canManage: boolean;
  onChange: (v: { TELEGRAM: View; SLACK: View }) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of FIELDS[kind]) o[f.key] = String(view?.config?.[f.key] ?? '');
    return o;
  });
  const [enabled, setEnabled] = useState(view?.enabled ?? false);
  const [minSeverity, setMin] = useState(view?.minSeverity ?? 'WARNING');
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(path: string, body: unknown, label: string) {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.TELEGRAM !== undefined) onChange({ TELEGRAM: json.TELEGRAM, SLACK: json.SLACK });
      if (!res.ok) setMsg({ tone: 'bad', text: json.error ?? 'Request failed' });
      else setMsg({ tone: 'good', text: label === 'test' ? 'Test message delivered.' : json.registered ? `Saved. Webhook registered at ${json.registered}` : 'Saved.' });
      router.refresh();
    } catch { setMsg({ tone: 'bad', text: 'Network error' }); }
    setBusy(null);
  }

  const save = (registerWebhook = false) => call('/api/integrations', { kind, enabled, minSeverity, config: form, registerWebhook }, registerWebhook ? 'register' : 'save');
  const status = !view ? 'Not connected' : view.lastError ? 'Error' : view.enabled ? 'Live' : 'Paused';
  const tone = status === 'Live' ? 'good' : status === 'Error' ? 'critical' : 'medium';

  return (
    <div className="panel lift reveal">
      <div className="panel-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo kind={kind} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
            {view?.deliveries ? `${view.deliveries} deliveries${view.lastDeliveryAt ? ` · last ${new Date(view.lastDeliveryAt).toLocaleString()}` : ''}` : 'No deliveries yet'}
          </div>
        </div>
        <span className={`chip chip-${tone}`}>{status === 'Live' ? <span className="pulse-dot" /> : null}{status}</span>
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: 0, lineHeight: 1.55 }}>{blurb}</p>
        {FIELDS[kind].map((f) => (
          <div className="field" key={f.key}>
            <label className="label" htmlFor={`${kind}-${f.key}`}>{f.label}</label>
            <input id={`${kind}-${f.key}`} className="input mono" disabled={!canManage} autoComplete="off"
              type="text" spellCheck={false}
              value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={'secret' in f && f.secret && view?.config?.[f.key] ? 'Stored — leave as is to keep' : ''} />
            <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{f.hint}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={enabled} disabled={!canManage} onChange={(e) => setEnabled(e.target.checked)} /> Send alerts
          </label>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13 }}>
            Minimum severity
            <select className="input" style={{ width: 'auto', height: 30 }} value={minSeverity} disabled={!canManage} onChange={(e) => setMin(e.target.value)}>
              <option value="INFO">Info</option><option value="WARNING">Warning</option><option value="CRITICAL">Critical</option>
            </select>
          </label>
        </div>
        {view?.webhook ? (
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
            {kind === 'TELEGRAM' ? 'Bot webhook' : 'Slash command request URL'}: <span className="mono" style={{ wordBreak: 'break-all' }}>{view.webhook}</span>
          </div>
        ) : null}
        {view?.lastError ? <div style={{ fontSize: 12, color: 'var(--critical)' }}>Last error: {view.lastError}</div> : null}
        {msg ? <div role="status" style={{ fontSize: 12.5, color: msg.tone === 'good' ? 'var(--good)' : 'var(--critical)' }}>{msg.text}</div> : null}
        {canManage ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => save(false)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            {kind === 'TELEGRAM' ? <button className="btn" disabled={!!busy} onClick={() => save(true)}>{busy === 'register' ? 'Registering…' : 'Save & register webhook'}</button> : null}
            <button className="btn" disabled={!!busy || !view} onClick={() => call('/api/integrations/test', { kind }, 'test')}>{busy === 'test' ? 'Sending…' : 'Send test'}</button>
          </div>
        ) : <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Only the firm owner can change integrations.</div>}
      </div>
    </div>
  );
}

function Logo({ kind }: { kind: 'TELEGRAM' | 'SLACK' }) {
  if (kind === 'TELEGRAM') return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="16" fill="#2AABEE" /><path d="M7.5 15.6 22.6 9.8c.7-.3 1.3.2 1.1 1.2l-2.6 12.1c-.2.9-.7 1.1-1.4.7l-3.9-2.9-1.9 1.8c-.2.2-.4.4-.8.4l.3-4 7.2-6.5c.3-.3-.1-.4-.5-.2l-8.9 5.6-3.8-1.2c-.8-.3-.8-.8.1-1.2Z" fill="#fff" /></svg>
  );
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" fill="var(--surface-2)" />
      <g transform="translate(7 7)"><rect x="0" y="7" width="7" height="3.2" rx="1.6" fill="#36C5F0" /><rect x="7" y="0" width="3.2" height="7" rx="1.6" fill="#2EB67D" /><rect x="11" y="8" width="7" height="3.2" rx="1.6" fill="#ECB22E" transform="rotate(0)" /><rect x="7.8" y="11" width="3.2" height="7" rx="1.6" fill="#E01E5A" /></g></svg>
  );
}
