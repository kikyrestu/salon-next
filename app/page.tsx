import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';

export const dynamic = 'force-dynamic';

export default async function Home() {
  await dbConnect();
  const { User } = initModels();
  const userCount = await User.countDocuments();
  console.log(`🏠 [HomePage] User count: ${userCount}`);

  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await auth();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
