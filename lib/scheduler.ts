import cron from 'node-cron';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import WaSchedule from '@/models/WaSchedule';
import WaFollowUpContact from '@/models/WaFollowUpContact';
import { sendWhatsApp } from '@/lib/fonnte';

let schedulerStarted = false;

const DEFAULT_SCHEDULER_TIMEZONE = 'Asia/Jakarta';

interface ProcessResult {
    total: number;
    sent: number;
    failed: number;
}

const fillTemplate = (template: string, vars: Record<string, string>): string => {
    return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => vars[key] ?? '');
};

export async function processPendingWaSchedules(now: Date = new Date()): Promise<ProcessResult> {
    await connectToDB();
    initModels();

    const schedules = await WaSchedule.find({
        scheduledAt: { $lte: now },
        status: 'pending',
    })
        .populate('customerId', 'name')
        .populate('templateId', 'name message')
        .populate({
            path: 'transactionId',
            select: 'items',
        });

    const phones = Array.from(new Set(schedules.map((schedule) => String(schedule.phoneNumber || '').trim()).filter(Boolean)));
    const inactiveContacts = await WaFollowUpContact.find({
        phoneNumber: { $in: phones },
        isActive: false,
    })
        .select('phoneNumber')
        .lean<any[]>();
    const inactiveSet = new Set(inactiveContacts.map((item: any) => String(item.phoneNumber || '').trim()));

    let sent = 0;
    let failed = 0;

    for (const schedule of schedules) {
        try {
            if (inactiveSet.has(String(schedule.phoneNumber || '').trim())) {
                continue;
            }

            const template: any = schedule.templateId;
            if (!template?.message) {
                await WaSchedule.findByIdAndUpdate(schedule._id, { status: 'failed' });
                failed += 1;
                continue;
            }

            const customer: any = schedule.customerId;
            const transaction: any = schedule.transactionId;
            const serviceNames = (transaction?.items || [])
                .filter((item: any) => item?.itemModel === 'Service')
                .map((item: any) => String(item?.name || '').trim())
                .filter(Boolean);

            const message = fillTemplate(template.message, {
                nama_customer: String(customer?.name || 'Pelanggan'),
                nama_service: serviceNames.length > 0 ? serviceNames.join(', ') : 'Layanan',
            });

            const result = await sendWhatsApp(schedule.phoneNumber, message);

            if (result.success) {
                await WaSchedule.findByIdAndUpdate(schedule._id, {
                    status: 'sent',
                    sentAt: new Date(),
                });
                sent += 1;
            } else {
                await WaSchedule.findByIdAndUpdate(schedule._id, {
                    status: 'failed',
                });
                failed += 1;
            }
        } catch (error) {
            await WaSchedule.findByIdAndUpdate(schedule._id, { status: 'failed' });
            failed += 1;
        }
    }

    return {
        total: schedules.length,
        sent,
        failed,
    };
}

export function startWaScheduler() {
    if (schedulerStarted) return;

    // Vercel functions are ephemeral. Use Vercel Cron or external scheduler in production.
    if (process.env.VERCEL === '1') {
        return;
    }

    const rawTimezone = (process.env.TZ || '').trim();
    const normalizedTimezone = rawTimezone.startsWith(':') ? rawTimezone.slice(1) : rawTimezone;

    let schedulerTimezone = DEFAULT_SCHEDULER_TIMEZONE;
    if (normalizedTimezone) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimezone });
            schedulerTimezone = normalizedTimezone;
        } catch {
            schedulerTimezone = DEFAULT_SCHEDULER_TIMEZONE;
        }
    }

    cron.schedule(
        '0 9 * * *',
        async () => {
            await processPendingWaSchedules();
        },
        {
            timezone: schedulerTimezone,
        }
    );

    schedulerStarted = true;
}
