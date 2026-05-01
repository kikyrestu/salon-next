import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';


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

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaGreetingLog } = await getTenantModels(tenantSlug);

    try {
        if (!hasValidSecret(request)) {
            const permissionError = await checkPermission(request, 'settings', 'edit');
            if (permissionError) return permissionError;
        }

        
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

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaGreetingLog } = await getTenantModels(tenantSlug);

    try {
        if (!hasValidSecret(request)) {
            const permissionError = await checkPermission(request, 'settings', 'edit');
            if (permissionError) return permissionError;
        }

        
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
