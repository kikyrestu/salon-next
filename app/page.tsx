import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();
  const slug = (session?.user as any)?.tenantSlug || 'pusat';

  if (session) {
    redirect(`/${slug}/dashboard`);
  } else {
    redirect(`/${slug}/login`);
  }
}
