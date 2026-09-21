export const SYNTHETIC =
  'SYNTHETIC SAMPLE DOCUMENT — FICTIONAL COMPANY — PREPARED FOR SOFTWARE DEMONSTRATION ONLY. Names, figures and events are invented; any resemblance to a real entity is coincidental.';

export const n = (v: number) => v.toLocaleString('en-US');

/** A pipe table in the house format the extractors read back. */
export function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.map((c) => (typeof c === 'number' ? n(c) : c)).join(' | ')} |`;
  return [line(headers), `|${headers.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n');
}

export function doc(title: string, meta: [string, string][], body: string[]): string {
  return [
    SYNTHETIC,
    '',
    title.toUpperCase(),
    '',
    ...meta.map(([k, v]) => `${k}: ${v}`),
    '',
    ...body,
  ].join('\n');
}
