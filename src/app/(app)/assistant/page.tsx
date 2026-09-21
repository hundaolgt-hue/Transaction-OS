import { requireStaff } from '@/lib/auth';
import AssistantDock from '@/components/AssistantDock';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  await requireStaff();
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header className="reveal">
        <div className="eyebrow">Portfolio assistant</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 4px' }}>Ask the OS</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: 0, maxWidth: '72ch' }}>
          Questions across every engagement — missing documents, critical findings, covenant headroom, ratios, fees,
          milestones, who owns what. Answers cite the records they came from.
          {env.aiEnabled ? ' Claude reasons over the retrieved records.' : ' Running on the built-in retrieval engine; set ANTHROPIC_API_KEY for Claude-written answers.'}
        </p>
      </header>
      <div className="panel reveal" style={{ height: 'min(720px, calc(100dvh - 220px))', display: 'flex', flexDirection: 'column' }}>
        <AssistantDock audience="staff" inline />
      </div>
    </div>
  );
}
