import { NextRequest, NextResponse } from 'next/server';
import { processPendingWaSchedules, processPendingCampaigns, processAutomations } from '@/lib/scheduler';

export async function GET(request: NextRequest) {
    try {
        console.log('[CRON TRIGGER] Manually running scheduler tasks...');
        await Promise.all([
            processPendingWaSchedules(),
            processPendingCampaigns(),
            processAutomations()
        ]);
        console.log('[CRON TRIGGER] Finished running scheduler tasks.');
        return NextResponse.json({ success: true, message: 'Cron tasks triggered successfully' });
    } catch (error: any) {
        console.error('[CRON TRIGGER] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
