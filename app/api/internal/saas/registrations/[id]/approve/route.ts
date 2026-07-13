import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { approveRegistration } from '@/lib/provisioning';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const { planId, billingPeriod } = body;

        const result = await approveRegistration(id, { planId, billingPeriod });

        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            success: true,
            message: 'Toko berhasil di-approve.',
            data: {
                storeId: result.storeId,
                slug: result.slug,
                storeName: result.storeName,
                loginUrl: result.loginUrl,
                subscriptionId: result.subscriptionId ?? null,
                subscriptionExpiresAt: result.subscriptionExpiresAt ?? null,
            },
        });
    } catch (error: any) {
        console.error('[internal/saas/registrations/id/approve][POST] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
