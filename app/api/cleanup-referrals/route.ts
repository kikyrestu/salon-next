/**
 * One-time cleanup script: Remove referral codes from non-premium customers
 * Run via: node -e "require('./scripts/cleanup-referral-codes.js')"
 * Or just hit this API endpoint once
 */
import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import Customer from '@/models/Customer';

export async function POST() {
    try {
        await connectToDB();

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
