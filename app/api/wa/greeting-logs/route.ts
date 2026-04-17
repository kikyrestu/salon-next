import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import WaGreetingLog from '@/models/WaGreetingLog';

const normalizePhone = (phone: string): string => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    return digits;
};

function hasValidSecret(request: NextRequest): boolean {
    const configuredSecret = process.env.WA_TRIGGER_SECRET;
    if (!configuredSecret) return false;

    const headerSecret = request.headers.get('x-trigger-secret');
    return headerSecret === configuredSecret;
}

export async function GET(request: NextRequest) {
    try {
        if (!hasValidSecret(request)) {
            const permissionError = await checkPermission(request, 'settings', 'edit');
            if (permissionError) return permissionError;
        }

        await connectToDB();
        const total = await WaGreetingLog.countDocuments();
        const items = await WaGreetingLog.find({})
            .select('phoneRaw phoneNormalized greetingSentAt createdAt')
            .sort({ greetingSentAt: -1 })
            .limit(50)
            .lean();

        return NextResponse.json({ success: true, data: { total, items } });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to fetch greeting logs' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        if (!hasValidSecret(request)) {
            const permissionError = await checkPermission(request, 'settings', 'edit');
            if (permissionError) return permissionError;
        }

        await connectToDB();
        const body = await request.json();
        const phone = String(body?.phone || '').trim();
        const clearAll = Boolean(body?.clearAll);

        if (clearAll) {
            const result = await WaGreetingLog.deleteMany({});
            return NextResponse.json({
                success: true,
                message: 'All greeting logs deleted',
                data: { deletedCount: result.deletedCount || 0 },
            });
        }

        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
            return NextResponse.json(
                { success: false, error: 'phone is required' },
                { status: 400 }
            );
        }

        const result = await WaGreetingLog.deleteOne({ phoneNormalized: normalizedPhone });

        return NextResponse.json({
            success: true,
            message: result.deletedCount ? 'Greeting log deleted' : 'Greeting log not found',
            data: {
                deletedCount: result.deletedCount || 0,
                phone: normalizedPhone,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to delete greeting log' },
            { status: 500 }
        );
    }
}
