import { NextResponse } from 'next/server';
import { processPendingCampaigns, processAutomations } from '@/lib/scheduler';
import { connectToDB } from '@/lib/mongodb';

// F-01 Fix: This endpoint proxies the cron trigger without requiring the client to expose CRON_SECRET.
export async function POST() {
    try {
        await connectToDB();
        
        // Run both scheduler tasks without awaiting so the API responds quickly
        processPendingCampaigns().catch(console.error);
        processAutomations().catch(console.error);

        return NextResponse.json({ success: true, message: 'Scheduler triggered successfully via internal proxy' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
