import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import ActivityLog from '@/models/ActivityLog';
import { checkPermission } from '@/lib/rbac';
import { initModels } from '@/lib/initModels';

export async function GET(request: NextRequest) {
    try {
        await connectToDB();
        initModels();

        // Security Check
        const permissionError = await checkPermission(request, 'reports', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        const total = await ActivityLog.countDocuments();
        const logs = await ActivityLog.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
