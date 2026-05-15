import { NextResponse } from 'next/server';
import { processPendingCampaigns, processAutomations } from '@/lib/scheduler';
import { connectToDB } from '@/lib/mongodb';

// This endpoint is used to manually trigger the WA scheduler.
// In Next.js environments (like Vercel or Dev Mode), background Node.js cron jobs
// are often killed or suspended. By pinging this endpoint, we force the scheduler
// to process the pending queue.
export async function GET(req: Request) {
    try {
        // BUG-09 Fix: Add authorization check
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDB();
        
        // Run both scheduler tasks without awaiting so the API responds quickly
        // and doesn't block the frontend ping.
        processPendingCampaigns().catch(console.error);
        processAutomations().catch(console.error);

        return NextResponse.json({ success: true, message: 'Scheduler triggered successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
