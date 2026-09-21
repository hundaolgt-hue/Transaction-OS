import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { getOrg } from '@/lib/repo/core';
import { unreadCount } from '@/lib/notify';
import PortalShell from '@/components/PortalShell';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'CLIENT') redirect('/dashboard');

  const org = getOrg(session.orgId);
  return (
    <PortalShell session={session} advisorName={org?.name ?? BRAND.name} unread={unreadCount(session.userId)}>
      {children}
    </PortalShell>
  );
}
