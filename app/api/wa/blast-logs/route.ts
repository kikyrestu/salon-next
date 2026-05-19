import { getTenantModels } from "@/lib/tenantDb";
/**
 * GET /api/wa/blast-logs — View blast history
 */
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaBlastLog, WaCampaignQueue } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'customers', 'view');
    if (permError) return permError;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    const overFetch = (page * limit) + limit; // fetch enough for current page and buffer

    try {
        const [blastLogs, queuedLogs] = await Promise.all([
            WaBlastLog.find()
                .sort({ createdAt: -1 })
                .limit(overFetch)
                .populate('sentBy', 'name')
                .select('campaignName message targetCount sentCount failedCount createdAt sentBy')
                .lean(),
            WaCampaignQueue.find({ status: { $in: ['completed', 'failed'] } })
                .sort({ scheduledAt: -1 })
                .limit(overFetch)
                .populate('sentBy', 'name')
                .select('campaignName message scheduledAt createdAt targets.status sentBy')
                .lean(),
        ]);

        const mappedQueued = queuedLogs.map((q: any) => {
            const sentCount = q.targets?.filter((t: any) => t.status === 'sent').length || 0;
            const failedCount = q.targets?.filter((t: any) => t.status === 'failed').length || 0;
            
            return {
                _id: q._id,
                campaignName: q.campaignName || "Automated Campaign",
                message: q.message || "Pesan otomatis dari sistem",
                targetCount: q.targets?.length || 0,
                sentCount,
                failedCount,
                createdAt: q.scheduledAt || q.createdAt || new Date(),
                sentBy: { name: 'System (Scheduler)' }
            };
        });

        const combined = [...blastLogs, ...mappedQueued].sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const paginated = combined.slice(skip, skip + limit);
        const hasMore = combined.length > skip + limit;

        return NextResponse.json({
            success: true,
            data: paginated,
            hasMore,
            page,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
