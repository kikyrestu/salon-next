import { getTenantModels } from "@/lib/tenantDb";
/**
 * GET /api/cron/wa-daily-report
 * Send daily sales summary to the owner via WA.
 */
import { NextRequest, NextResponse } from 'next/server';



import { decryptFonnteToken } from '@/lib/encryption';
import { sendWhatsApp } from '@/lib/fonnte';
import { hasRunToday, markAsRun } from '@/lib/cronDedup';

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Settings } = await getTenantModels(tenantSlug);

    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        
        

        const settings = await Settings.findOne();
        const ownerPhone = settings?.waOwnerNumber;
        const storeName = settings?.storeName || 'Salon';
        const fonnteToken = settings?.fonnteToken ? decryptFonnteToken(String(settings.fonnteToken).trim()) : undefined;

        // FLOW-04 FIX: Cek apakah scheduler sudah kirim daily report hari ini
        if (await hasRunToday('daily_report', tenantSlug)) {
            return NextResponse.json({
                success: true,
                message: 'Daily report already sent today (by scheduler or previous cron run)',
                sent: 0,
                skipped: true,
            });
        }

        if (!ownerPhone) {
            return NextResponse.json({
                success: true,
                message: 'No owner WA number configured in settings',
                sent: 0,
            });
        }

        // Get today's date range
        const tz = 'Asia/Jakarta';
        const today = new Date();
        const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(today);
        const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(today);
        const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(today);
        
        // Create full dates using timezone formatting
        const startOfDayStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000+07:00`;
        const startOfDay = new Date(startOfDayStr);
        const endOfDayStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59.999+07:00`;
        const endOfDay = new Date(endOfDayStr);

        // Query today's paid invoices
        const invoices = await Invoice.find({
            date: { $gte: startOfDay, $lt: endOfDay },
            status: 'paid',
        }).lean();

        // Calculate totals
        const totalCustomers = new Set(invoices.map((inv: any) => String(inv.customer))).size;
        const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);
        const totalTips = invoices.reduce((sum: number, inv: any) => sum + (inv.tips || 0), 0);

        // Payment method breakdown
        const paymentBreakdown: Record<string, number> = {};
        for (const inv of invoices) {
            const methods = (inv as any).paymentMethods;
            if (Array.isArray(methods) && methods.length > 0) {
                for (const pm of methods) {
                    const method = pm.method || 'Other';
                    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (pm.amount || 0);
                }
            } else {
                const method = (inv as any).paymentMethod || 'Cash';
                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + ((inv as any).amountPaid || 0);
            }
        }

        // Format day name in Indonesian
        // Use the startOfDay WIB to correctly get day
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = dayNames[startOfDay.getDay()];
        const dateStr = startOfDay.toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        const fmt = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

        // Build payment breakdown text
        const paymentLines = Object.entries(paymentBreakdown)
            .map(([method, amount]) => `• ${method}: ${fmt(amount)}`)
            .join('\n');

        const message =
            `📊 *Laporan Harian — ${storeName}*\n\n` +
            `📅 Hari *${dayName}*, ${dateStr}\n\n` +
            `👥 Total Customer Visit: *${totalCustomers} orang*\n` +
            `🧾 Total Transaksi: *${invoices.length}*\n\n` +
            `💰 *Rincian Pembayaran:*\n` +
            `${paymentLines || '• Belum ada transaksi'}\n\n` +
            `💵 Total Pendapatan: *${fmt(totalRevenue)}*\n` +
            (totalTips > 0 ? `💝 Total Tips: *${fmt(totalTips)}*\n` : '') +
            `\n— Generated by ${storeName} POS System`;

        const result = await sendWhatsApp(ownerPhone, message, fonnteToken);

        if (result.success) {
            await markAsRun('daily_report', tenantSlug, 'cron_route');
        }

        return NextResponse.json({
            success: true,
            message: 'Daily report sent to owner',
            sent: result.success ? 1 : 0,
            report: {
                date: dateStr,
                totalCustomers,
                totalTransactions: invoices.length,
                totalRevenue,
                totalTips,
                paymentBreakdown,
            },
            error: result.error || undefined,
        });
    } catch (error: any) {
        console.error('WA daily report cron error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
