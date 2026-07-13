import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { rejectRegistration } from '@/lib/provisioning';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const { rejectionReason } = body;

        const result = await rejectRegistration(id, rejectionReason);

        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        return NextResponse.json({ success: true, message: 'Pendaftaran ditolak.' });
    } catch (error: any) {
        console.error('[internal/saas/registrations/id/reject][POST] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
