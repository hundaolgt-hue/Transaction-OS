/**
 * Dependency-free SVG charts. The same markup renders on screen (with CSS
 * variable colours) and inside pdfmake PDFs (with literal print colours), so
 * a figure in a report is the figure the reviewer saw in the app.
 */

export interface ChartTheme {
  ink: string; muted: string; faint: string; grid: string; ground: string;
  series: string[]; good: string; high: string; critical: string; medium: string; low: string;
  font: string;
}

export const PRINT_THEME: ChartTheme = {
  ink: '#16201c', muted: '#4a5652', faint: '#8a938f', grid: '#e3e7e5', ground: '#ffffff',
  series: ['#D97F0E', '#0A7F1A', '#2d5f9e', '#7a5aa8', '#96751a', '#3f8fa8'],
  good: '#0A7F1A', high: '#c73e1d', critical: '#c0392f', medium: '#96751a', low: '#2d5f9e',
  font: 'Roboto, Helvetica, Arial, sans-serif',
};

export const SCREEN_THEME: ChartTheme = {
  ink: 'var(--ink)', muted: 'var(--ink-muted)', faint: 'var(--ink-faint)', grid: 'var(--hairline)', ground: 'transparent',
  series: ['var(--accent)', 'var(--good)', 'var(--low)', '#8a5fc0', 'var(--medium)', '#3f8fa8'],
  good: 'var(--good)', high: 'var(--high)', critical: 'var(--critical)', medium: 'var(--medium)', low: 'var(--low)',
  font: 'inherit',
};

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}bn`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${Math.round(v * 10) / 10}`;
};

export interface Series { name: string; values: number[]; color?: string }

/** Grouped vertical bars with an optional line series on a secondary percent axis. */
export function barChart(opts: {
  labels: string[]; series: Series[]; width?: number; height?: number; theme?: ChartTheme;
  format?: (v: number) => string; line?: { name: string; values: number[]; format?: (v: number) => string };
  title?: string;
}): string {
  const t = opts.theme ?? PRINT_THEME;
  const W = opts.width ?? 520, H = opts.height ?? 230;
  const padL = 46, padR = opts.line ? 44 : 12, padT = opts.title ? 26 : 12, padB = 44;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = niceMax(Math.max(1, ...opts.series.flatMap((s) => s.values)));
  const fmt = opts.format ?? compact;
  const groups = opts.labels.length;
  const gw = iw / groups;
  const bw = Math.min(34, (gw * 0.7) / opts.series.length);
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${t.ground}"/>`);
  if (opts.title) parts.push(`<text x="${padL}" y="16" font-size="11" font-weight="bold" fill="${t.ink}" font-family="${t.font}">${esc(opts.title)}</text>`);
  for (let i = 0; i <= 4; i++) {
    const y = padT + ih - (ih * i) / 4;
    parts.push(`<line x1="${padL}" x2="${padL + iw}" y1="${y}" y2="${y}" stroke="${t.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 6}" y="${y + 3}" font-size="8.5" text-anchor="end" fill="${t.faint}" font-family="${t.font}">${esc(fmt((max * i) / 4))}</text>`);
  }
  opts.labels.forEach((lab, g) => {
    const gx = padL + gw * g + (gw - bw * opts.series.length) / 2;
    opts.series.forEach((s, k) => {
      const v = s.values[g] ?? 0;
      const h = Math.max(0, (v / max) * ih);
      const x = gx + k * bw;
      parts.push(`<rect x="${x.toFixed(1)}" y="${(padT + ih - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${s.color ?? t.series[k % t.series.length]}"/>`);
    });
    parts.push(`<text x="${(padL + gw * g + gw / 2).toFixed(1)}" y="${padT + ih + 14}" font-size="9" text-anchor="middle" fill="${t.muted}" font-family="${t.font}">${esc(lab)}</text>`);
  });
  if (opts.line) {
    const lmax = niceMax(Math.max(0.0001, ...opts.line.values));
    const pts = opts.line.values.map((v, g) => [padL + gw * g + gw / 2, padT + ih - (v / lmax) * ih]);
    parts.push(`<polyline points="${pts.map((p) => p.map((c) => c.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${t.ink}" stroke-width="1.6"/>`);
    pts.forEach(([x, y], i) => {
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${t.ground === 'transparent' ? t.ink : t.ground}" stroke="${t.ink}" stroke-width="1.4"/>`);
      parts.push(`<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" font-size="8.5" text-anchor="middle" fill="${t.ink}" font-family="${t.font}">${esc((opts.line!.format ?? ((v) => `${(v * 100).toFixed(1)}%`))(opts.line!.values[i]))}</text>`);
    });
    for (let i = 0; i <= 4; i++) {
      const y = padT + ih - (ih * i) / 4;
      parts.push(`<text x="${padL + iw + 6}" y="${y + 3}" font-size="8.5" fill="${t.faint}" font-family="${t.font}">${esc((opts.line.format ?? ((v) => `${(v * 100).toFixed(0)}%`))((lmax * i) / 4))}</text>`);
    }
  }
  // Legend
  const legend = [...opts.series.map((s, k) => ({ name: s.name, color: s.color ?? t.series[k % t.series.length], line: false })), ...(opts.line ? [{ name: opts.line.name, color: t.ink, line: true }] : [])];
  let lx = padL;
  legend.forEach((l) => {
    parts.push(l.line
      ? `<line x1="${lx}" x2="${lx + 12}" y1="${H - 11}" y2="${H - 11}" stroke="${l.color}" stroke-width="2"/>`
      : `<rect x="${lx}" y="${H - 16}" width="10" height="10" rx="2" fill="${l.color}"/>`);
    parts.push(`<text x="${lx + 15}" y="${H - 8}" font-size="9" fill="${t.muted}" font-family="${t.font}">${esc(l.name)}</text>`);
    lx += 22 + l.name.length * 5.2;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

/** Multi-series line chart. */
export function lineChart(opts: { labels: string[]; series: Series[]; width?: number; height?: number; theme?: ChartTheme; format?: (v: number) => string; title?: string; minZero?: boolean }): string {
  const t = opts.theme ?? PRINT_THEME;
  const W = opts.width ?? 520, H = opts.height ?? 220;
  const padL = 46, padR = 16, padT = opts.title ? 26 : 12, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const all = opts.series.flatMap((s) => s.values);
  const max = niceMax(Math.max(...all));
  const min = opts.minZero === false ? Math.min(0, ...all) : 0;
  const fmt = opts.format ?? compact;
  const X = (i: number) => padL + (opts.labels.length === 1 ? iw / 2 : (iw * i) / (opts.labels.length - 1));
  const Y = (v: number) => padT + ih - ((v - min) / (max - min || 1)) * ih;
  const parts: string[] = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${t.ground}"/>`];
  if (opts.title) parts.push(`<text x="${padL}" y="16" font-size="11" font-weight="bold" fill="${t.ink}" font-family="${t.font}">${esc(opts.title)}</text>`);
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4, y = Y(v);
    parts.push(`<line x1="${padL}" x2="${padL + iw}" y1="${y}" y2="${y}" stroke="${t.grid}"/>`);
    parts.push(`<text x="${padL - 6}" y="${y + 3}" font-size="8.5" text-anchor="end" fill="${t.faint}" font-family="${t.font}">${esc(fmt(v))}</text>`);
  }
  opts.labels.forEach((l, i) => parts.push(`<text x="${X(i)}" y="${padT + ih + 14}" font-size="9" text-anchor="middle" fill="${t.muted}" font-family="${t.font}">${esc(l)}</text>`));
  opts.series.forEach((s, k) => {
    const c = s.color ?? t.series[k % t.series.length];
    const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    parts.push(`<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2"/>`);
    s.values.forEach((v, i) => parts.push(`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === s.values.length - 1 ? 3.5 : 2.4}" fill="${c}"/>`));
  });
  let lx = padL;
  opts.series.forEach((s, k) => {
    parts.push(`<rect x="${lx}" y="${H - 15}" width="10" height="3" fill="${s.color ?? t.series[k % t.series.length]}"/>`);
    parts.push(`<text x="${lx + 14}" y="${H - 11}" font-size="9" fill="${t.muted}" font-family="${t.font}">${esc(s.name)}</text>`);
    lx += 24 + s.name.length * 5.2;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

/** Donut with legend and centre label. */
export function donut(opts: { items: { label: string; value: number; color?: string }[]; width?: number; height?: number; theme?: ChartTheme; centre?: string; sub?: string; title?: string }): string {
  const t = opts.theme ?? PRINT_THEME;
  const W = opts.width ?? 420, H = opts.height ?? 200;
  const cx = 100, cy = H / 2 + (opts.title ? 8 : 0), r = Math.min(80, H / 2 - 14), ri = r * 0.6;
  const total = opts.items.reduce((a, b) => a + b.value, 0) || 1;
  let a0 = -Math.PI / 2;
  const parts: string[] = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${t.ground}"/>`];
  if (opts.title) parts.push(`<text x="8" y="16" font-size="11" font-weight="bold" fill="${t.ink}" font-family="${t.font}">${esc(opts.title)}</text>`);
  opts.items.forEach((it, k) => {
    const frac = it.value / total;
    if (frac <= 0) return;
    const a1 = a0 + frac * Math.PI * 2 - (frac === 1 ? 0.0001 : 0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => `${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    parts.push(`<path d="M${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} L${p(a1, ri)} A${ri},${ri} 0 ${large} 0 ${p(a0, ri)} Z" fill="${it.color ?? t.series[k % t.series.length]}" stroke="${t.ground === 'transparent' ? 'none' : t.ground}" stroke-width="1.5"/>`);
    a0 = a1;
  });
  if (opts.centre) parts.push(`<text x="${cx}" y="${cy + 3}" font-size="15" font-weight="bold" text-anchor="middle" fill="${t.ink}" font-family="${t.font}">${esc(opts.centre)}</text>`);
  if (opts.sub) parts.push(`<text x="${cx}" y="${cy + 17}" font-size="8.5" text-anchor="middle" fill="${t.faint}" font-family="${t.font}">${esc(opts.sub)}</text>`);
  opts.items.forEach((it, k) => {
    const y = 26 + k * 18 + (opts.title ? 10 : 0);
    parts.push(`<rect x="205" y="${y - 9}" width="10" height="10" rx="2" fill="${it.color ?? t.series[k % t.series.length]}"/>`);
    parts.push(`<text x="221" y="${y}" font-size="9.5" fill="${t.muted}" font-family="${t.font}">${esc(it.label.length > 34 ? it.label.slice(0, 33) + '…' : it.label)}</text>`);
    parts.push(`<text x="${W - 8}" y="${y}" font-size="9.5" text-anchor="end" fill="${t.ink}" font-family="${t.font}">${((it.value / total) * 100).toFixed(1)}%</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

/** Horizontal bars — good for ranked items with long labels. */
export function hbar(opts: { items: { label: string; value: number; color?: string }[]; width?: number; theme?: ChartTheme; format?: (v: number) => string; title?: string; max?: number }): string {
  const t = opts.theme ?? PRINT_THEME;
  const W = opts.width ?? 520, row = 20, padT = opts.title ? 26 : 8;
  const H = padT + opts.items.length * row + 8;
  const labelW = 190, iw = W - labelW - 60;
  const max = opts.max ?? niceMax(Math.max(1, ...opts.items.map((i) => i.value)));
  const fmt = opts.format ?? compact;
  const parts: string[] = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${t.ground}"/>`];
  if (opts.title) parts.push(`<text x="0" y="16" font-size="11" font-weight="bold" fill="${t.ink}" font-family="${t.font}">${esc(opts.title)}</text>`);
  opts.items.forEach((it, k) => {
    const y = padT + k * row;
    const w = Math.max(1, (it.value / max) * iw);
    parts.push(`<text x="${labelW - 8}" y="${y + 13}" font-size="9" text-anchor="end" fill="${t.muted}" font-family="${t.font}">${esc(it.label.length > 36 ? it.label.slice(0, 35) + '…' : it.label)}</text>`);
    parts.push(`<rect x="${labelW}" y="${y + 4}" width="${iw}" height="12" rx="2" fill="${t.grid}"/>`);
    parts.push(`<rect x="${labelW}" y="${y + 4}" width="${w.toFixed(1)}" height="12" rx="2" fill="${it.color ?? t.series[0]}"/>`);
    parts.push(`<text x="${labelW + iw + 6}" y="${y + 13}" font-size="9" fill="${t.ink}" font-family="${t.font}">${esc(fmt(it.value))}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

/** 5×5 likelihood × impact heat map with counts. */
export function heatmap(opts: { cells: { likelihood: number; impact: number }[]; width?: number; theme?: ChartTheme; title?: string }): string {
  const t = opts.theme ?? PRINT_THEME;
  const W = opts.width ?? 300, padL = 34, padT = opts.title ? 26 : 8, cell = (W - padL - 8) / 5;
  const H = padT + cell * 5 + 34;
  const parts: string[] = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${t.ground}"/>`];
  if (opts.title) parts.push(`<text x="0" y="16" font-size="11" font-weight="bold" fill="${t.ink}" font-family="${t.font}">${esc(opts.title)}</text>`);
  for (let i = 5; i >= 1; i--) {
    for (let l = 1; l <= 5; l++) {
      const score = i * l;
      const count = opts.cells.filter((c) => c.impact === i && c.likelihood === l).length;
      const base = score >= 20 ? t.critical : score >= 12 ? t.high : score >= 6 ? t.medium : t.good;
      const x = padL + (l - 1) * cell, y = padT + (5 - i) * cell;
      parts.push(`<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="3" fill="${base}" fill-opacity="${count ? 0.92 : 0.16}"/>`);
      if (count) parts.push(`<text x="${x + cell / 2}" y="${y + cell / 2 + 4}" font-size="12" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="${t.font}">${count}</text>`);
    }
    parts.push(`<text x="${padL - 8}" y="${padT + (5 - i) * cell + cell / 2 + 3}" font-size="9" text-anchor="end" fill="${t.faint}" font-family="${t.font}">${i}</text>`);
  }
  for (let l = 1; l <= 5; l++) parts.push(`<text x="${padL + (l - 0.5) * cell}" y="${padT + 5 * cell + 13}" font-size="9" text-anchor="middle" fill="${t.faint}" font-family="${t.font}">${l}</text>`);
  parts.push(`<text x="${padL + 2.5 * cell}" y="${H - 4}" font-size="9" text-anchor="middle" fill="${t.muted}" font-family="${t.font}">Likelihood →</text>`);
  parts.push(`<text x="10" y="${padT + 2.5 * cell}" font-size="9" text-anchor="middle" fill="${t.muted}" font-family="${t.font}" transform="rotate(-90 10 ${padT + 2.5 * cell})">Impact →</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

/** Stacked horizontal bars per row — severity mix per engagement. */
export function stackedBars(opts: { rows: { label: string; parts: { key: string; value: number }[] }[]; colors: Record<string, string>; width?: number; theme?: ChartTheme }): string {
  const t = opts.theme ?? PRINT_THEME;
  const W = opts.width ?? 520, row = 26, labelW = 130;
  const H = opts.rows.length * row + 26;
  const max = Math.max(1, ...opts.rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  const iw = W - labelW - 30;
  const parts: string[] = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${t.ground}"/>`];
  opts.rows.forEach((r, k) => {
    const y = k * row + 4;
    parts.push(`<text x="${labelW - 8}" y="${y + 13}" font-size="9.5" text-anchor="end" fill="${t.muted}" font-family="${t.font}">${esc(r.label)}</text>`);
    let x = labelW;
    r.parts.forEach((p) => {
      const w = (p.value / max) * iw;
      if (w > 0) parts.push(`<rect x="${x.toFixed(1)}" y="${y + 3}" width="${Math.max(0, w - 1).toFixed(1)}" height="14" rx="2" fill="${opts.colors[p.key] ?? t.series[0]}"/>`);
      x += w;
    });
    parts.push(`<text x="${(x + 6).toFixed(1)}" y="${y + 14}" font-size="9" fill="${t.ink}" font-family="${t.font}">${r.parts.reduce((a, p) => a + p.value, 0)}</text>`);
  });
  let lx = labelW;
  Object.entries(opts.colors).forEach(([k, c]) => {
    parts.push(`<rect x="${lx}" y="${H - 14}" width="10" height="10" rx="2" fill="${c}"/>`);
    parts.push(`<text x="${lx + 14}" y="${H - 5}" font-size="9" fill="${t.muted}" font-family="${t.font}">${esc(k.charAt(0) + k.slice(1).toLowerCase())}</text>`);
    lx += 26 + k.length * 5.5;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}
