/** Writes the synthetic data room as PDF files to data/dataroom-pdf/. */
import fs from 'node:fs';
import path from 'node:path';
import { ABYSSINIA_DATAROOM, COMPANY } from '../src/lib/dataroom/abyssinia';
import { dataRoomPdf } from '../src/lib/reports/dataRoomPdf';
import { renderPdf } from '../src/lib/reports/render';

async function main() {
  const out = path.resolve('data/dataroom-pdf');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let i = 0;
  for (const d of ABYSSINIA_DATAROOM) {
    i++;
    const { bytes, pages } = await renderPdf(dataRoomPdf(d.title, d.body, COMPANY.name));
    const name = `${String(i).padStart(2, '0')}_${d.code ?? 'OTHER'}_${d.fileName.replace(/\.txt$/, '.pdf')}`;
    fs.writeFileSync(path.join(out, name), bytes);
    console.log(`${name}  ${pages}p`);
  }
  fs.writeFileSync(path.join(out, 'README.txt'), `Synthetic data room for ${COMPANY.name} — a fictional company.\nEvery document is invented for software demonstration and carries a banner saying so.\nFile names start with the ECMA checklist code each document satisfies.\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
