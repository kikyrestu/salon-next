import { getTenantModels } from "@/lib/tenantDb";
/**
 * GET /api/wa/blast-logs — View blast history
 */
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaBlastLog } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'customers', 'view');
    if (permError) return permError;

    
    

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    try {
        const [logs, total] = await Promise.all([
            WaBlastLog.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('sentBy', 'name')
                .select('-recipients')
                .lean(),
            WaBlastLog.countDocuments(),
        ]);

        return NextResponse.json({
            success: true,
            data: logs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
