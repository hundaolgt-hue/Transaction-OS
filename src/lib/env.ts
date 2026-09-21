import path from 'node:path';

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

const dataDir = path.resolve(process.cwd(), str('DATA_DIR', 'data'));

export const env = {
  dataDir,
  dbPath: path.join(dataDir, 'advisor-os.db'),
  uploadDir: path.join(dataDir, 'uploads'),
  authSecret: str('AUTH_SECRET', 'dev-secret-change-me-in-production-0123456789abcdef'),
  appUrl: str('APP_URL', 'http://localhost:3000'),
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
