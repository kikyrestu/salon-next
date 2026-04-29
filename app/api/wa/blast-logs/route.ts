/**
 * GET /api/wa/blast-logs — View blast history
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';
import WaBlastLog from '@/models/WaBlastLog';

export async function GET(request: NextRequest) {
    const permError = await checkPermission(request, 'customers', 'view');
    if (permError) return permError;

    await connectToDB();
    initModels();

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
