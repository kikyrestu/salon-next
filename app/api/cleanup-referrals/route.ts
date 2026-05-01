import { getTenantModels } from "@/lib/tenantDb";
/**
 * One-time cleanup script: Remove referral codes from non-premium customers
 * Run via: node -e "require('./scripts/cleanup-referral-codes.js')"
 * Or just hit this API endpoint once
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
        const { Customer } = await getTenantModels(tenantSlug);

        // Remove referral codes from non-premium customers
        const result = await Customer.updateMany(
            {
                membershipTier: { $ne: 'premium' },
                referralCode: { $ne: null, $exists: true }
            },
            { $unset: { referralCode: 1 } }
        );

        return NextResponse.json({
            success: true,
            message: `Cleaned ${result.modifiedCount} non-premium referral codes`,
            modifiedCount: result.modifiedCount,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
