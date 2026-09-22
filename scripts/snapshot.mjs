// Writes the demo snapshot restored on first boot (see src/lib/db.ts):
// seed/advisor-os.db (a compacted copy of the seeded database) and seed/uploads/.
// Run after `npm run seed`:  npm run seed:snapshot
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const src = path.join(dataDir, 'advisor-os.db');
if (!fs.existsSync(src)) { console.error('No database at', src, '— run npm run seed first.'); process.exit(1); }
const out = path.resolve('seed');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const d = new Database(src);
d.pragma('wal_checkpoint(TRUNCATE)');
d.exec(`VACUUM INTO '${path.join(out, 'advisor-os.db').replace(/'/g, "''")}'`);
d.close();
const snap = new Database(path.join(out, 'advisor-os.db'));
snap.pragma('journal_mode = DELETE');
snap.close();
const up = path.join(dataDir, 'uploads');
if (fs.existsSync(up)) fs.cpSync(up, path.join(out, 'uploads'), { recursive: true });
console.log('snapshot written to', out);
