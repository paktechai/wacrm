import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { HomePage } from '@/components/marketing/home-page';
import { SiteShell } from '@/components/marketing/site-shell';
import { isCrmHostname } from '@/lib/brand';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata(
  'Wova8 — Business software for customer operations',
  'Wova8 builds practical software for customer communication, relationship management, automation, and AI-assisted business operations.',
  '/'
);

export default async function RootPage() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');

  if (isCrmHostname(host)) redirect('/dashboard');

  return (
    <SiteShell>
      <HomePage />
    </SiteShell>
  );
}
