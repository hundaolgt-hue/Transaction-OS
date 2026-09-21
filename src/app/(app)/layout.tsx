import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getOrg, listEngagements, listClients } from '@/lib/repo/core';
import { unreadCount } from '@/lib/notify';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'CLIENT') redirect('/portal');

  const org = getOrg(session.orgId);
  const engagements = listEngagements(session.orgId);
  const clients = listClients(session.orgId);
  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <Shell
      session={session}
      orgName={org?.name ?? 'Advisor OS'}
      unread={unreadCount(session.userId)}
      engagements={engagements.slice(0, 8).map((e) => ({
        id: e.id, reference: e.reference, name: e.name,
        client: clientById.get(e.clientId) ?? '—', stage: e.stage,
      }))}
    >
      {children}
    </Shell>
  );
}
