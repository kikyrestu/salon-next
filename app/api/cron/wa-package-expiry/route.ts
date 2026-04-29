/**
 * GET /api/cron/wa-package-expiry
 * Notify customers whose packages are expiring soon.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import CustomerPackage from '@/models/CustomerPackage';
import Customer from '@/models/Customer';
import Settings from '@/models/Settings';
import { sendWhatsApp } from '@/lib/fonnte';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDB();
        initModels();

        const settings = await Settings.findOne();
        const reminderDays = settings?.packageExpiryReminderDays || 30;
        const storeName = settings?.storeName || 'Salon';

        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + reminderDays);

        // Find active packages expiring within the reminder window
        const expiringPackages = await CustomerPackage.find({
            status: 'active',
            expiresAt: { $gte: now, $lte: futureDate },
        })
            .populate('customer', 'name phone waNotifEnabled')
            .lean();

        let sentCount = 0;
        const errors: string[] = [];

        for (const pkg of expiringPackages) {
            const customer = pkg.customer as any;
            if (!customer?.phone || !customer?.waNotifEnabled) continue;

            const expiryDate = new Date(pkg.expiresAt!).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });

            const remainingQuota = (pkg.serviceQuotas || [])
                .map((q: any) => `• ${q.serviceName}: sisa ${q.remainingQuota}x`)
                .join('\n');

            const message =
                `📦 *Pengingat Paket — ${storeName}*\n\n` +
                `Halo *${customer.name}*,\n\n` +
                `Paket *${pkg.packageName}* Anda akan segera berakhir pada *${expiryDate}*.\n\n` +
                (remainingQuota ? `Sisa kuota:\n${remainingQuota}\n\n` : '') +
                `Segera gunakan sebelum habis atau perpanjang paket Anda! 🙏\n\n` +
                `- ${storeName}`;

            try {
                const result = await sendWhatsApp(customer.phone, message);
                if (result.success) sentCount++;
                else errors.push(`${customer.name}: ${result.error}`);
            } catch (err: any) {
                errors.push(`${customer.name}: ${err.message}`);
            }

            await new Promise((r) => setTimeout(r, 500));
        }

        return NextResponse.json({
            success: true,
            message: `Package expiry reminder sent to ${sentCount} customer(s)`,
            sent: sentCount,
            total: expiringPackages.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('WA package expiry cron error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
