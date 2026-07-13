import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { getMasterModels } from '@/lib/masterDb';

// List gabungan Store + TenantSubscription aktifnya. Dipakai buat tabel utama
// dashboard admin panel PHP ("daftar semua toko terdaftar beserta status
// langganan masing-masing" - Modul B di blueprint client).
//
// Store.subscriptionStatus/subscriptionExpiresAt (field cache) dipakai buat
// enforcement cepat di auth.config.ts - di endpoint LIST ini kita tetap join
// ke TenantSubscription biar admin panel bisa nampilin nama plan & billing
// period-nya juga, bukan cuma status doang.
export async function GET(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search')?.trim();

        const filter: any = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
            ];
        }

        const stores = await master.Store.find(filter).sort({ createdAt: -1 });
        const storeIds = stores.map((s) => s._id);

        const activeSubscriptions = await master.TenantSubscription.find({
            storeId: { $in: storeIds },
            status: 'active',
        });
        const subscriptionByStoreId = new Map(activeSubscriptions.map((sub) => [sub.storeId.toString(), sub]));

        const data = stores.map((store) => {
            const sub = subscriptionByStoreId.get(store._id.toString());
            return {
                _id: store._id,
                name: store.name,
                slug: store.slug,
                isActive: store.isActive,
                subscriptionStatus: store.subscriptionStatus,
                subscriptionExpiresAt: store.subscriptionExpiresAt,
                createdAt: store.createdAt,
                subscription: sub
                    ? {
                          _id: sub._id,
                          planName: sub.planSnapshot.name,
                          billingPeriod: sub.billingPeriod,
                          startDate: sub.startDate,
                          expiresAt: sub.expiresAt,
                          activeAddOnsCount: sub.activeAddOns.length,
                      }
                    : null,
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('[internal/saas/stores][GET] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
