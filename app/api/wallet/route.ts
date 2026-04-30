/**
 * GET  /api/wallet — Get wallet history for a customer
 * POST /api/wallet — Top-up or deduct wallet balance
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import { auth } from '@/auth';
import Customer from '@/models/Customer';
import WalletTransaction from '@/models/WalletTransaction';
import Settings from '@/models/Settings';

/* ------------------------------------------------------------------ */
/*  GET — Wallet history for a customer                                */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
    await connectToDB();
    initModels();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        if (customerId) {
            // Get specific customer wallet
            const customer = await Customer.findById(customerId)
                .select('name phone walletBalance')
                .lean();

            const transactions = await WalletTransaction.find({ customer: customerId })
                .populate('performedBy', 'name')
                .populate('invoice', 'invoiceNumber')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            return NextResponse.json({
                success: true,
                data: {
                    customer,
                    transactions,
                    balance: (customer as any)?.walletBalance || 0,
                },
            });
        }

        // Get all customers with wallet balance > 0
        const customers = await Customer.find({ walletBalance: { $gt: 0 } })
            .select('name phone walletBalance membershipTier')
            .sort({ walletBalance: -1 })
            .lean();

        return NextResponse.json({ success: true, data: customers });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/* ------------------------------------------------------------------ */
/*  POST — Top-up or deduct wallet                                     */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
    await connectToDB();
    initModels();

    const session: any = await auth();
    const body = await request.json();
    const { customerId, amount, type, paymentMethod, description, invoiceId } = body;

    if (!customerId || !amount || amount <= 0) {
        return NextResponse.json({ success: false, error: 'customerId dan amount wajib diisi' }, { status: 400 });
    }

    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return NextResponse.json({ success: false, error: 'Customer tidak ditemukan' }, { status: 404 });
        }

        const txType = type || 'topup';
        let finalAmount = amount;
        let bonusAmount = 0;
        let bonusPercent = 0;
        let desc = description || '';

        if (txType === 'topup') {
            // Calculate bonus from settings tiers
            const settings = await Settings.findOne({}).lean() as any;
            const tiers = (settings?.walletBonusTiers || [])
                .filter((t: any) => t.minAmount && t.bonusPercent)
                .sort((a: any, b: any) => b.minAmount - a.minAmount); // Highest first

            for (const tier of tiers) {
                if (amount >= tier.minAmount) {
                    bonusPercent = tier.bonusPercent;
                    bonusAmount = Math.round(amount * (tier.bonusPercent / 100));
                    break;
                }
            }

            finalAmount = amount + bonusAmount;
            customer.walletBalance = (customer.walletBalance || 0) + finalAmount;
            desc = desc || `Top-up ${paymentMethod || 'Cash'} Rp${amount.toLocaleString('id-ID')}${bonusAmount > 0 ? ` + Bonus ${bonusPercent}% (Rp${bonusAmount.toLocaleString('id-ID')})` : ''}`;

            await customer.save();

            // Create transaction record
            const tx = await WalletTransaction.create({
                customer: customerId,
                type: 'topup',
                amount: finalAmount,
                balanceAfter: customer.walletBalance,
                description: desc,
                topupMethod: paymentMethod || 'Cash',
                bonusPercent,
                bonusAmount,
                performedBy: session?.user?.id,
            });

            return NextResponse.json({
                success: true,
                data: {
                    transaction: tx,
                    newBalance: customer.walletBalance,
                    topupAmount: amount,
                    bonusAmount,
                    bonusPercent,
                    totalCredited: finalAmount,
                },
            });
        }

        if (txType === 'payment') {
            // Deduct from wallet for invoice payment
            if ((customer.walletBalance || 0) < amount) {
                return NextResponse.json({ success: false, error: `Saldo tidak cukup. Saldo: Rp${(customer.walletBalance || 0).toLocaleString('id-ID')}` }, { status: 400 });
            }

            customer.walletBalance = (customer.walletBalance || 0) - amount;
            desc = desc || `Pembayaran via Wallet`;

            await customer.save();

            const tx = await WalletTransaction.create({
                customer: customerId,
                type: 'payment',
                amount: -amount,
                balanceAfter: customer.walletBalance,
                description: desc,
                invoice: invoiceId || undefined,
                performedBy: session?.user?.id,
            });

            return NextResponse.json({
                success: true,
                data: {
                    transaction: tx,
                    newBalance: customer.walletBalance,
                    deducted: amount,
                },
            });
        }

        if (txType === 'refund') {
            customer.walletBalance = (customer.walletBalance || 0) + amount;
            desc = desc || `Refund ke Wallet`;

            await customer.save();

            const tx = await WalletTransaction.create({
                customer: customerId,
                type: 'refund',
                amount: amount,
                balanceAfter: customer.walletBalance,
                description: desc,
                invoice: invoiceId || undefined,
                performedBy: session?.user?.id,
            });

            return NextResponse.json({
                success: true,
                data: {
                    transaction: tx,
                    newBalance: customer.walletBalance,
                },
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
