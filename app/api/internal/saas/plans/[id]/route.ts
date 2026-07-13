import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { getMasterModels } from '@/lib/masterDb';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const { id } = await params;
        const plan = await master.SaasPlan.findById(id);

        if (!plan) {
            return NextResponse.json({ success: false, error: 'Plan tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: plan });
    } catch (error: any) {
        console.error('[internal/saas/plans/id][GET] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const { id } = await params;
        const body = await request.json();

        // code sengaja gak boleh diubah lewat PUT - dia dipakai sebagai referensi
        // internal (planSnapshot.code di TenantSubscription histori lama). Kalau
        // mau ganti kode plan, mending bikin plan baru + nonaktifin yang lama.
        const { code, ...updatable } = body;

        const plan = await master.SaasPlan.findByIdAndUpdate(id, updatable, {
            new: true,
            runValidators: true,
        });

        if (!plan) {
            return NextResponse.json({ success: false, error: 'Plan tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: plan });
    } catch (error: any) {
        console.error('[internal/saas/plans/id][PUT] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const { id } = await params;

        const referencedByActive = await master.TenantSubscription.findOne({ planId: id, status: 'active' });
        if (referencedByActive) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Plan ini masih dipakai toko yang subscription-nya aktif. Nonaktifkan (isActive: false) aja daripada dihapus.',
                },
                { status: 409 }
            );
        }

        const plan = await master.SaasPlan.findByIdAndDelete(id);
        if (!plan) {
            return NextResponse.json({ success: false, error: 'Plan tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Plan dihapus.' });
    } catch (error: any) {
        console.error('[internal/saas/plans/id][DELETE] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
