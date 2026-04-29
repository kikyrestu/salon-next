/**
 * GET /api/cron/wa-membership-expiry
 * Notify customers whose membership is expiring soon + loyalty points that will be lost.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
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

        const settings = await Settings.findOne();
        const reminderDays = settings?.membershipExpiryReminderDays || 30;
        const storeName = settings?.storeName || 'Salon';
        const loyaltyPointValue = settings?.loyaltyPointValue || 0;

        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + reminderDays);

        // Find customers with membership expiring within window
        const expiringMembers = await Customer.find({
            status: 'active',
            membershipTier: { $ne: 'regular' },
            membershipExpiry: { $gte: now, $lte: futureDate },
            phone: { $exists: true, $ne: '' },
            waNotifEnabled: true,
        }).lean();

        let sentCount = 0;
        const errors: string[] = [];

        for (const customer of expiringMembers) {
            const expiryDate = new Date(customer.membershipExpiry!).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });

            const loyaltyPoints = customer.loyaltyPoints || 0;
            const loyaltyValue = loyaltyPoints * loyaltyPointValue;

            let message =
                `👑 *Pengingat Membership — ${storeName}*\n\n` +
                `Halo *${customer.name}*,\n\n` +
                `Membership *${customer.membershipTier?.toUpperCase()}* Anda akan berakhir pada *${expiryDate}*.\n\n`;

            if (loyaltyPoints > 0) {
                message +=
                    `⚠️ Anda memiliki *${loyaltyPoints.toLocaleString('id-ID')} loyalty points*` +
                    (loyaltyValue > 0 ? ` (senilai Rp${loyaltyValue.toLocaleString('id-ID')})` : '') +
                    ` yang akan *hangus* jika membership tidak diperpanjang!\n\n`;
            }

            message +=
                `Perpanjang membership Anda untuk terus menikmati benefit eksklusif 💎\n\n` +
                `- ${storeName}`;

            try {
                const result = await sendWhatsApp(customer.phone!, message);
                if (result.success) sentCount++;
                else errors.push(`${customer.name}: ${result.error}`);
            } catch (err: any) {
                errors.push(`${customer.name}: ${err.message}`);
            }

            await new Promise((r) => setTimeout(r, 500));
        }

        return NextResponse.json({
            success: true,
            message: `Membership expiry reminder sent to ${sentCount} customer(s)`,
            sent: sentCount,
            total: expiringMembers.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('WA membership expiry cron error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
