import * as React from 'react';
import clsx from 'clsx';

// ------------------------------------------------------------------- panel

export function Panel({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={clsx('panel reveal', className)} {...rest}>{children}</section>;
}

export function PanelHead({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="panel-head">
      <div style={{ minWidth: 0 }}>
        <h2 className="panel-title">{title}</h2>
        {sub ? <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 0' }}>{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 6, flex: 'none' }}>{actions}</div> : null}
    </header>
  );
}

// -------------------------------------------------------------------- chip

export type Tone = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'good' | 'neutral';

const SEVERITY_TONE: Record<string, Tone> = {
  CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'info',
};

const STATUS_TONE: Record<string, Tone> = {
  ACCEPTED: 'good', WAIVED: 'good', APPROVED: 'good', RESOLVED: 'good', PAID: 'good',
  COMPLETED: 'good', SUCCEEDED: 'good', SIGNED: 'good', DONE: 'good', ACTIVE: 'good', DRAFTED: 'good',
  SUBMITTED: 'low', UNDER_REVIEW: 'low', IN_REVIEW: 'low', RUNNING: 'low', DOING: 'low',
  INVOICED: 'low', REQUESTED: 'low', ACKNOWLEDGED: 'low', DRAFTING: 'low', IN_PROGRESS: 'low',
  MISSING: 'high', REJECTED: 'critical', FAILED: 'critical', BLOCKED: 'critical', OPEN: 'high',
  IN_REMEDIATION: 'medium', PENDING: 'neutral', QUEUED: 'neutral', DRAFT: 'neutral',
  NOT_STARTED: 'neutral', UNBILLED: 'neutral', TODO: 'neutral', DISMISSED: 'neutral',
  FALSE_POSITIVE: 'neutral', SUPERSEDED: 'neutral', MITIGATING: 'medium', ACCEPTED_RISK: 'medium',
};

export function Chip({ children, tone = 'neutral', dot, className }: {
  children: React.ReactNode; tone?: Tone; dot?: boolean; className?: string;
}) {
  return (
    <span className={clsx('chip', `chip-${tone}`, className)}>
      {dot ? <i className="chip-dot" /> : null}
      {children}
    </span>
  );
}

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function StatusChip({ status, dot = true }: { status: string; dot?: boolean }) {
  return <Chip tone={STATUS_TONE[status] ?? 'neutral'} dot={dot}>{pretty(status)}</Chip>;
}

export function SeverityChip({ severity }: { severity: string }) {
  return <Chip tone={SEVERITY_TONE[severity] ?? 'neutral'} dot>{pretty(severity)}</Chip>;
}

// ------------------------------------------------------------------ meter

export function Meter({ value, tone, label, showValue = true }: {
  value: number; tone?: 'ok' | 'warn' | 'bad'; label?: React.ReactNode; showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const auto = pct >= 75 ? 'ok' : pct >= 40 ? 'warn' : 'bad';
  const t = tone ?? auto;
  return (
    <div>
      {label || showValue ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
          {label ? <span style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>{label}</span> : <span />}
          {showValue ? <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{pct}%</span> : null}
        </div>
      ) : null}
      <div className={clsx('meter', t === 'warn' && 'warn', t === 'bad' && 'bad')} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- stats

export function Stat({ label, value, sub, tone, icon }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone; icon?: React.ReactNode;
}) {
  const color = tone && tone !== 'neutral' ? `var(--${tone === 'good' ? 'good' : tone})` : 'var(--ink)';
  return (
    <div className="panel" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon}
        <span className="eyebrow">{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 5, lineHeight: 1.45 }}>{sub}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------- empty

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {body ? <div className="empty-body">{body}</div> : null}
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------ layout

export function Grid({ cols = 4, gap = 12, min = 190, children }: {
  cols?: number; gap?: number; min?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap, gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }} data-cols={cols}>
      {children}
    </div>
  );
}

export function Row({ children, gap = 8, wrap = true, align = 'center', justify }: {
  children: React.ReactNode; gap?: number; wrap?: boolean; align?: string; justify?: string;
}) {
  return (
    <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: align, justifyContent: justify }}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ avatar

export function Avatar({ name, color, size = 24 }: { name: string; color?: string | null; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: 99, flex: 'none',
        background: color ?? 'var(--surface-3)',
        color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 600, letterSpacing: '.02em',
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

// ------------------------------------------------------------- definition

export function Defs({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, auto) 1fr', gap: '9px 16px', margin: 0, fontSize: 13 }}>
      {items.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{k}</dt>
          <dd style={{ margin: 0, color: 'var(--ink)' }}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
