import { getTenantModels } from "@/lib/tenantDb";
/**
 * GET  /api/wa/blast-targets — Filter customers for WA blast
 * POST /api/wa/blast-targets — Send WA blast to filtered customers
 */
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';
import { auth } from '@/auth';

import { sendWhatsApp } from '@/lib/fonnte';

/* ------------------------------------------------------------------ */
/*  GET — Filter customers for blast preview                           */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer, Invoice, WaBlastLog } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'customers', 'view');
    if (permError) return permError;

    const { searchParams } = new URL(request.url);
    const lastVisitSince = searchParams.get('lastVisitSince');
    const serviceId = searchParams.get('serviceId');
    const membershipTier = searchParams.get('membershipTier');
    const birthdayMonth = searchParams.get('birthdayMonth');
    const hasPhone = searchParams.get('hasPhone') !== 'false'; // default true

    try {
        // Start with all active customers with phone
        const customerQuery: any = { status: 'active' };
        if (hasPhone) {
            customerQuery.phone = { $exists: true, $ne: '' };
        }
        if (membershipTier) {
            customerQuery.membershipTier = membershipTier;
        }

        let customerIds: string[] | null = null;

        // Filter by last visit (invoice date)
        if (lastVisitSince) {
            const sinceDate = new Date(lastVisitSince);
            const invoiceQuery: any = {
                date: { $gte: sinceDate },
                status: 'paid',
            };
            if (serviceId) {
                invoiceQuery['items.item'] = serviceId;
                invoiceQuery['items.itemModel'] = 'Service';
            }
            const invoices = await Invoice.find(invoiceQuery)
                .select('customer')
                .lean();
            customerIds = [...new Set(invoices.map((inv: any) => String(inv.customer)))];
        } else if (serviceId) {
            // Filter by service without date constraint
            const invoices = await Invoice.find({
                'items.item': serviceId,
                'items.itemModel': 'Service',
                status: 'paid',
            })
                .select('customer')
                .lean();
            customerIds = [...new Set(invoices.map((inv: any) => String(inv.customer)))];
        }

        if (customerIds !== null) {
            customerQuery._id = { $in: customerIds };
        }

        // Birthday month filter
        if (birthdayMonth) {
            const month = parseInt(birthdayMonth);
            if (month >= 1 && month <= 12) {
                // MongoDB aggregation for birthday month
                const customersWithBirthday = await Customer.aggregate([
                    { $match: { ...customerQuery, birthday: { $exists: true, $ne: null } } },
                    { $addFields: { bdayMonth: { $month: '$birthday' } } },
                    { $match: { bdayMonth: month } },
                    { $project: { name: 1, email: 1, phone: 1, membershipTier: 1, birthday: 1, waNotifEnabled: 1 } },
                ]);
                return NextResponse.json({
                    success: true,
                    data: customersWithBirthday,
                    total: customersWithBirthday.length,
                });
            }
        }

        const customers = await Customer.find(customerQuery)
            .select('name email phone membershipTier birthday waNotifEnabled')
            .sort({ name: 1 })
            .limit(500)
            .lean();

        return NextResponse.json({
            success: true,
            data: customers,
            total: customers.length,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/* ------------------------------------------------------------------ */
/*  POST — Send WA blast to selected customers                         */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer, WaBlastLog, Settings } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'customers', 'edit');
    if (permError) return permError;

    const body = await request.json();
    const { customerIds, message, campaignName, filters } = body;

    if (!message?.trim()) {
        return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }
    if (!customerIds?.length) {
        return NextResponse.json({ success: false, error: 'No customers selected' }, { status: 400 });
    }

    const session: any = await auth();
    const customers = await Customer.find({
        _id: { $in: customerIds },
        phone: { $exists: true, $ne: '' },
        waNotifEnabled: true,
    })
        .select('name phone')
        .lean();

    // Get tenant Fonnte token
    const tenantSettings: any = await Settings.findOne({});
    const fonnteToken = tenantSettings?.fonnteToken ? String(tenantSettings.fonnteToken).trim() : undefined;

    const recipients: any[] = [];
    let sentCount = 0;
    let failedCount = 0;

    // Safety check for manual sending
    if (customers.length > 5) {
        return NextResponse.json({ 
            success: false, 
            error: 'Manual blast dibatasi maksimal 5 orang demi keamanan nomor WA. Gunakan fitur "Schedule" untuk mengirim ke lebih banyak orang secara otomatis & aman.' 
        }, { status: 400 });
    }

    for (const customer of customers) {
        const personalizedMsg = message
            .replace(/{{nama_customer}}/gi, (customer as any).name || 'Pelanggan');

        try {
            const result = await sendWhatsApp((customer as any).phone, personalizedMsg, fonnteToken);
            if (result.success) {
                sentCount++;
                recipients.push({
                    customerId: (customer as any)._id,
                    phone: (customer as any).phone,
                    status: 'sent',
                });
            } else {
                failedCount++;
                recipients.push({
                    customerId: (customer as any)._id,
                    phone: (customer as any).phone,
                    status: 'failed',
                    error: result.error,
                });
            }
        } catch (err: any) {
            failedCount++;
            recipients.push({
                customerId: (customer as any)._id,
                phone: (customer as any).phone,
                status: 'failed',
                error: err.message,
            });
        }

        // Delay between messages to avoid rate limiting / WA suspension
        // 30 seconds per message for safety in manual mode
        if (sentCount + failedCount < customers.length) {
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }
    }

    // Save blast log
    await WaBlastLog.create({
        campaignName: campaignName || `Blast ${new Date().toLocaleDateString('id-ID')}`,
        message,
        targetCount: customerIds.length,
        sentCount,
        failedCount,
        filters: filters || {},
        recipients,
        sentBy: session?.user?.id,
    });

    return NextResponse.json({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: customers.length,
        failedRecipients: recipients
            .filter((r: any) => r.status === 'failed')
            .map((r: any) => ({ phone: r.phone, error: r.error || 'Unknown error' })),
    });
}
