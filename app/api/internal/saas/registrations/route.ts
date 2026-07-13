import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { getMasterModels } from '@/lib/masterDb';

export async function GET(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const master = await getMasterModels();
        const query = status ? { status } : {};

        const registrations = await master.Registration.find(query).sort({ createdAt: -1 });

        // Jangan kirim hashedPassword ke client, sama kayak app/api/admin/registrations/route.ts
        const safeRegistrations = registrations.map((reg) => {
            const { hashedPassword, ...doc } = reg.toObject();
            return doc;
        });

        return NextResponse.json({ success: true, data: safeRegistrations });
    } catch (error: any) {
        console.error('[internal/saas/registrations][GET] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
