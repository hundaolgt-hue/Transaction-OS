import path from 'node:path';

// Values copied verbatim from .env.example are placeholders, not configuration.
const PLACEHOLDERS = new Set(['change-me', 'changeme', '""', "''"]);

function str(key: string, fallback = ''): string {
  // Also strip surrounding quotes pasted in from a .env file into a dashboard.
  const v = process.env[key]?.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
  return v === undefined || v === '' || PLACEHOLDERS.has(v.toLowerCase()) ? fallback : v;
}

// On Vercel the deployment filesystem is read-only; only /tmp is writable.
// Without an explicit DATA_DIR the database lives in /tmp there and is
// restored from the bundled demo snapshot (seed/) on each cold start.
const onVercel = Boolean(process.env.VERCEL);
const dataDir = path.resolve(process.cwd(), str('DATA_DIR', onVercel ? '/tmp/advisor-os' : 'data'));
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

export const env = {
  dataDir,
  dbPath: path.join(dataDir, 'advisor-os.db'),
  uploadDir: path.join(dataDir, 'uploads'),
  authSecret: str('AUTH_SECRET', 'dev-secret-change-me-in-production-0123456789abcdef'),
  // A localhost APP_URL (the .env.example default) is ignored on Vercel.
  appUrl: (() => {
    const v = str('APP_URL');
    if (v && !(onVercel && /localhost|127\.0\.0\.1/.test(v))) return v.replace(/\/$/, '');
    return vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000';
  })(),
  onVercel,
  snapshotDir: path.join(process.cwd(), 'seed'),
  anthropicApiKey: str('ANTHROPIC_API_KEY'),
  anthropicModel: str('ANTHROPIC_MODEL', 'claude-sonnet-4-5'),
  smtpHost: str('SMTP_HOST'),
  smtpPort: Number(str('SMTP_PORT', '587')),
  smtpUser: str('SMTP_USER'),
  smtpPass: str('SMTP_PASS'),
  mailFrom: str('MAIL_FROM', 'Advisor OS <no-reply@advisor-os.et>'),
  get aiEnabled() {
    return this.anthropicApiKey.length > 10;
  },
  get mailEnabled() {
    return this.smtpHost.length > 0;
  },
};
