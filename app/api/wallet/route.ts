import { getTenantModels } from "@/lib/tenantDb";
/**
 * GET  /api/wallet — Get wallet history for a customer
 * POST /api/wallet — Top-up or deduct wallet balance
 */
import { NextRequest, NextResponse } from 'next/server';

import { checkPermissionWithSession } from '@/lib/rbac';

/* ------------------------------------------------------------------ */
/*  GET — Wallet history for a customer                                */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer, WalletTransaction, Settings } = await getTenantModels(tenantSlug);

    
    

    const { error: permissionError } = await checkPermissionWithSession(request, 'customers', 'view');
    if (permissionError) return permissionError;

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

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer, WalletTransaction, Settings } = await getTenantModels(tenantSlug);

    // [B14 FIX] Gunakan checkPermissionWithSession — 1 auth() call
    const { error: permissionError, session } = await checkPermissionWithSession(request, 'customers', 'edit');
    if (permissionError) return permissionError;

    const body = await request.json();
    const { customerId, type, paymentMethod, description, invoiceId } = body;
    
    const amountNum = Number(body.amount);

    if (!customerId || !amountNum || isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ success: false, error: 'customerId dan amount valid wajib diisi (> 0)' }, { status: 400 });
    }

    try {
        const txType = type || 'topup';
        let finalAmount = amountNum;
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
                if (amountNum >= tier.minAmount) {
                    bonusPercent = tier.bonusPercent;
                    bonusAmount = Math.round(amountNum * (tier.bonusPercent / 100));
                    break;
                }
            }

            finalAmount = amountNum + bonusAmount;
            desc = desc || `Top-up ${paymentMethod || 'Cash'} Rp${amountNum.toLocaleString('id-ID')}${bonusAmount > 0 ? ` + Bonus ${bonusPercent}% (Rp${bonusAmount.toLocaleString('id-ID')})` : ''}`;

            // Atomic top-up
            const customer = await Customer.findByIdAndUpdate(
                customerId,
                { $inc: { walletBalance: finalAmount } },
                { new: true }
            );

            if (!customer) {
                return NextResponse.json({ success: false, error: 'Customer tidak ditemukan' }, { status: 404 });
            }

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

            // Cash Drawer integration: if top-up paid in Cash, record it atomically
            if ((paymentMethod || 'Cash').toLowerCase() === 'cash') {
                try {
                    const CashBalance = (await import('@/models/CashBalance')).default;
                    const CashLog = (await import('@/models/CashLog')).default;

                    const balance = await CashBalance.findOneAndUpdate(
                        {},
                        { $inc: { kasirBalance: amountNum }, $set: { lastUpdatedAt: new Date() } },
                        { new: true, upsert: true }
                    );

                    await CashLog.create({
                        type: 'sale',
                        amount: amountNum,
                        sourceLocation: 'customer',
                        destinationLocation: 'kasir',
                        performedBy: session?.user?.id,
                        description: `Wallet Top-Up Cash - ${customer.name}`,
                        balanceAfter: {
                            kasir: balance.kasirBalance,
                            brankas: balance.brankasBalance,
                            bank: balance.bankBalance,
                        },
                    });
                } catch (cashErr) {
                    console.error('[Wallet] Cash Drawer log error:', cashErr);
                }
            }

            return NextResponse.json({
                success: true,
                data: {
                    transaction: tx,
                    newBalance: customer.walletBalance,
                    topupAmount: amountNum,
                    bonusAmount,
                    bonusPercent,
                    totalCredited: finalAmount,
                },
            });
        }

        if (txType === 'payment') {
            desc = desc || `Pembayaran via Wallet`;

            // Atomic payment deduction
            const customer = await Customer.findOneAndUpdate(
                { _id: customerId, walletBalance: { $gte: amountNum } },
                { $inc: { walletBalance: -amountNum } },
                { new: true }
            );

            if (!customer) {
                return NextResponse.json({ success: false, error: `Saldo tidak cukup atau Customer tidak ditemukan.` }, { status: 400 });
            }

            const tx = await WalletTransaction.create({
                customer: customerId,
                type: 'payment',
                amount: -amountNum,
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
                    deducted: amountNum,
                },
            });
        }

        if (txType === 'refund') {
            desc = desc || `Refund ke Wallet`;

            // Atomic refund
            const customer = await Customer.findByIdAndUpdate(
                customerId,
                { $inc: { walletBalance: amountNum } },
                { new: true }
            );

            if (!customer) {
                return NextResponse.json({ success: false, error: 'Customer tidak ditemukan' }, { status: 404 });
            }

            const tx = await WalletTransaction.create({
                customer: customerId,
                type: 'refund',
                amount: amountNum,
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
