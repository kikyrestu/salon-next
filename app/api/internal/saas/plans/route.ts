import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { getMasterModels } from '@/lib/masterDb';

export async function GET(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get('includeInactive') === 'true';

        const filter = includeInactive ? {} : { isActive: true };
        const plans = await master.SaasPlan.find(filter).sort({ sortOrder: 1, createdAt: 1 });

        return NextResponse.json({ success: true, data: plans });
    } catch (error: any) {
        console.error('[internal/saas/plans][GET] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const body = await request.json();

        const { name, code, description, limits, pricingOptions, availableAddOns, isActive, sortOrder } = body;

        if (!name || !code || !limits || !Array.isArray(pricingOptions) || pricingOptions.length === 0) {
            return NextResponse.json(
                { success: false, error: 'name, code, limits, dan minimal 1 pricingOptions wajib diisi.' },
                { status: 400 }
            );
        }

        const existing = await master.SaasPlan.findOne({ code: code.toLowerCase().trim() });
        if (existing) {
            return NextResponse.json({ success: false, error: `Kode plan "${code}" sudah dipakai.` }, { status: 400 });
        }

        const plan = await master.SaasPlan.create({
            name,
            code,
            description,
            limits,
            pricingOptions,
            availableAddOns: availableAddOns || [],
            isActive: isActive ?? true,
            sortOrder: sortOrder ?? 0,
        });

        return NextResponse.json({ success: true, data: plan }, { status: 201 });
    } catch (error: any) {
        console.error('[internal/saas/plans][POST] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
