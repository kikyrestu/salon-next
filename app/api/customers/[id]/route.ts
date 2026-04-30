import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/models/Customer';
import { normalizeIndonesianPhone } from '@/lib/phone';

// GET /api/customers/[id] - Get single customer
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;

        const customer = await Customer.findById(id).populate('referredBy', 'name');

        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'Customer not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: customer });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;
        const body = await request.json();

        if (body?.phone) {
            body.phone = normalizeIndonesianPhone(body.phone);
        }

        // Handle membership tier change → manage referral code
        if (body.membershipTier) {
            const existing = await Customer.findById(id).lean() as any;
            if (existing) {
                // Upgrading to premium → auto-generate referral code if missing
                if (body.membershipTier === 'premium' && !existing.referralCode) {
                    const crypto = await import('crypto');
                    let referralCode: string | undefined;
                    let attempts = 0;
                    while (!referralCode && attempts < 10) {
                        const candidate = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
                        const exists = await Customer.findOne({ referralCode: candidate }).lean();
                        if (!exists) referralCode = candidate;
                        attempts++;
                    }
                    if (referralCode) body.referralCode = referralCode;
                }
                // Downgrading from premium → remove referral code
                if (body.membershipTier !== 'premium' && existing.membershipTier === 'premium') {
                    body.referralCode = null;
                }
            }
        }

        const customer = await Customer.findByIdAndUpdate(
            id,
            body,
            { new: true, runValidators: true }
        );

        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'Customer not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: customer });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
        );
    }
}

// DELETE /api/customers/[id] - Delete customer
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;

        const customer = await Customer.findByIdAndDelete(id);

        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'Customer not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
