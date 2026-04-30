import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';
import { processPendingWaSchedules } from '@/lib/scheduler';

function hasValidTriggerSecret(request: NextRequest): boolean {
    const configuredSecret = process.env.WA_TRIGGER_SECRET;
    if (!configuredSecret) return false;

    const headerSecret = request.headers.get('x-trigger-secret');
    return headerSecret === configuredSecret;
}

export async function POST(request: NextRequest) {
    try {
        const bySecret = hasValidTriggerSecret(request);

        if (!bySecret) {
            const permissionError = await checkPermission(request, 'services', 'edit');
            if (permissionError) return permissionError;
        }

        const { processPendingWaSchedules, processPendingCampaigns, processAutomations } = await import('@/lib/scheduler');

        const scheduleResult = await processPendingWaSchedules();
        await processPendingCampaigns();
        await processAutomations();

        return NextResponse.json({
            success: true,
            message: 'Scheduler trigger executed successfully',
            data: scheduleResult,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Failed to trigger WA scheduler',
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({ success: true, message: 'WA trigger endpoint is reachable' });
}
