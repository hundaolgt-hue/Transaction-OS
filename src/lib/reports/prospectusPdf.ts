/** The drafted offering document as a pdfmake definition. */
import type { EngagementSnapshot } from '../repo/core';
import { getRulePack } from '../rulepacks';
import { buildDraftContext } from '../drafting/context';
import { TRANSACTION_LABEL, fmtDate, titleCase, type TransactionType } from '../domain';
import { barChart, donut } from '../charts/svg';
import { mdToPdf, type Node } from './mdToPdf';
import { shell, cover, h1, p, svg, simpleTable, COLORS } from './styles';

export function buildProspectus(snap: EngagementSnapshot, meta: { firmName: string; date?: string }): Node {
  const pack = getRulePack(snap.engagement.rulePackKey);
  const c = buildDraftContext(snap);
  const date = meta.date ?? fmtDate(new Date().toISOString());
  const sections = [...snap.prospectus].sort((a, b) => a.sequence - b.sequence);
  const gaps = sections.reduce((a, s) => a + (s.body.match(/\[INFORMATION REQUIRED/g) ?? []).length, 0);
  const approved = sections.every((s) => s.status === 'APPROVED');

  const content: Node[] = [];
  content.push(...cover({
    eyebrow: `${pack.outputLabel} · ${TRANSACTION_LABEL[snap.engagement.transactionType as TransactionType] ?? ''}`,
    title: c.legalName,
    subtitle: snap.engagement.name,
    client: `${pack.outputLabel}${c.offer.price ? ` — Offer price Birr ${c.offer.price} per share` : ''}`,
    reference: snap.engagement.reference, firm: meta.firmName, date,
    status: approved ? 'All sections approved' : `Draft — ${sections.filter((s) => s.status === 'APPROVED').length} of ${sections.length} sections approved, ${gaps} information item${gaps === 1 ? '' : 's'} outstanding`,
    lines: [
      ['Issuer', c.legalName],
      ['Securities', c.offer.shares ? `${c.offer.shares.toLocaleString('en-US')} ordinary shares of Birr ${c.offer.par ?? '—'}` : 'To be stated'],
      ['Gross proceeds', c.offer.gross ? `Birr ${c.offer.gross.toLocaleString('en-US')}` : 'To be stated'],
      ['Transaction adviser', meta.firmName],
      ['Prepared under', `${pack.name} — ${pack.key} v${pack.version}`],
      ['Draft date', date],
    ],
  }));

  content.push({ text: 'Status of this draft', style: 'h1' });
  content.push(p(`This ${pack.outputLabel.toLowerCase()} was drafted section by section by the Prospectus Agent from the documents in the engagement data room, to the contents prescribed by the rule pack. Passages marked [INFORMATION REQUIRED] identify facts the documents do not yet support; they must be completed and every section approved by the responsible expert and the directors before the document is lodged with the Authority.`));
  content.push(simpleTable(['Code', 'Section', 'Words', 'Complete', 'Open items', 'Status'], sections.map((s) => [s.code, s.heading, String(s.wordCount), `${s.completeness}%`, String((s.body.match(/\[INFORMATION REQUIRED/g) ?? []).length), titleCase(s.status)]), [34, '*', 38, 44, 44, 60], [2, 3, 4]));
  content.push({ toc: { title: { text: 'Contents', style: 'h1' } }, pageBreak: 'before' });

  for (const s of sections) {
    content.push(h1(s.heading));
    content.push({ text: `${s.code} · Required by ${s.requiredBy ?? '—'}`, style: 'small', margin: [0, -6, 0, 10] });
    // Figures that belong with particular sections.
    if (s.code === 'P-05' && c.tables('ECMA-F-005')[0]) {
      const t = c.tables('ECMA-F-005')[0];
      content.push(...mdToPdf(s.body));
      content.push(svg(donut({ items: t.rows.map((r) => ({ label: r[1], value: Number(String(r[2]).replace(/,/g, '')) || 0 })), centre: c.offer.net ? `${Math.round(c.offer.net / 1e6)}m` : '', sub: 'net proceeds (Birr)', title: 'Application of proceeds', width: 480, height: 190 }), 450));
      continue;
    }
    if (s.code === 'P-10' && c.fin) {
      content.push(svg(barChart({ labels: c.fin.years, series: [{ name: 'Revenue', values: c.fin.revenue }, { name: 'Profit for the year', values: c.fin.pat }], line: { name: 'Net margin', values: c.ratios.map((r) => r.netMargin) }, title: "Revenue and profit (Birr '000)" })));
    }
    if (s.code === 'P-09' && c.tables('ECMA-C-005')[0]) {
      const t = c.tables('ECMA-C-005')[0];
      content.push(...mdToPdf(s.body));
      content.push(svg(donut({ items: t.rows.map((r) => ({ label: r[0], value: Number(String(r[2]).replace(/,/g, '')) || 0 })), title: 'Shareholding before the Offer', width: 480, height: 190 }), 450));
      continue;
    }
    content.push(...(s.body.trim() ? mdToPdf(s.body) : [p({ text: '[INFORMATION REQUIRED: section not yet drafted]', color: COLORS.high, bold: true } as never)]));
  }

  return shell({ title: pack.outputLabel, subtitle: snap.engagement.name, firm: meta.firmName, client: c.legalName, reference: snap.engagement.reference, draft: !approved, content });
}
