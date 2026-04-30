import cron from 'node-cron';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import WaSchedule from '@/models/WaSchedule';
import WaCampaignQueue from '@/models/WaCampaignQueue';
import WaBlastLog from '@/models/WaBlastLog';
import WaAutomation from '@/models/WaAutomation';
import Customer from '@/models/Customer';
import Product from '@/models/Product';
import CashSession from '@/models/CashSession';
import Settings from '@/models/Settings';
import { sendWhatsApp } from '@/lib/fonnte';

let schedulerStarted = false;

const DEFAULT_SCHEDULER_TIMEZONE = 'Asia/Jakarta';
const DEFAULT_SCHEDULER_CRON = '* * * * *';

interface ProcessResult {
    total: number;
    sent: number;
    failed: number;
}

const fillTemplate = (template: string, vars: Record<string, string>): string => {
    return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => vars[key] ?? '');
};

export async function processPendingCampaigns(now: Date = new Date()) {
    await connectToDB();
    initModels();

    // Find campaigns that are either processing, or pending and past scheduled time
    const campaigns = await WaCampaignQueue.find({
        $or: [
            { status: 'processing' },
            { status: 'pending', scheduledAt: { $lte: now } }
        ]
    });

    for (const campaign of campaigns) {
        // Mark as processing if it was pending
        if (campaign.status === 'pending') {
            campaign.status = 'processing';
            await campaign.save();
        }

        // Find targets that are still pending
        // Limit to 15 per run to avoid Vercel timeout (15 * 3s = 45s)
        const pendingTargets = campaign.targets.filter((t: any) => t.status === 'pending').slice(0, 15);
        
        if (pendingTargets.length === 0) {
            // All targets processed, mark campaign as completed
            campaign.status = 'completed';
            await campaign.save();

            const sentCount = campaign.targets.filter((t: any) => t.status === 'sent').length;
            const failedCount = campaign.targets.filter((t: any) => t.status === 'failed').length;

            // Save Blast Log
            await WaBlastLog.create({
                campaignName: campaign.campaignName,
                message: campaign.message,
                targetCount: campaign.targets.length,
                sentCount,
                failedCount,
                filters: campaign.filters,
                recipients: campaign.targets.map((t: any) => ({
                    customerId: t.customerId,
                    phone: t.phone,
                    status: t.status,
                    error: t.error
                })),
                sentBy: campaign.sentBy,
            });
            continue;
        }

        // We need customer names for template replacing
        const customerIds = pendingTargets.map((t: any) => t.customerId);
        const customers = await Customer.find({ _id: { $in: customerIds } }).select('name').lean();
        const customerMap = new Map(customers.map((c: any) => [String(c._id), c.name]));

        for (const target of pendingTargets) {
            const customerName = customerMap.get(String(target.customerId)) || 'Pelanggan';
            const personalizedMsg = campaign.message.replace(/{{nama_customer}}/gi, customerName);

            try {
                const result = await sendWhatsApp(target.phone, personalizedMsg);
                if (result.success) {
                    target.status = 'sent';
                } else {
                    target.status = 'failed';
                    target.error = result.error;
                }
            } catch (err: any) {
                target.status = 'failed';
                target.error = err.message;
            }

            // Save after each message so we don't lose progress if function times out
            await WaCampaignQueue.updateOne(
                { _id: campaign._id, "targets._id": target._id },
                { 
                    $set: { 
                        "targets.$.status": target.status,
                        "targets.$.error": target.error
                    } 
                }
            );

            // Delay to avoid Fonnte rate limit
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
}

export async function processAutomations(now: Date = new Date()) {
    await connectToDB();
    initModels();

    const currentHourMin = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: DEFAULT_SCHEDULER_TIMEZONE });
    const todayStr = now.toLocaleDateString('en-US', { timeZone: DEFAULT_SCHEDULER_TIMEZONE });

    const activeRules = await WaAutomation.find({ isActive: true });
    const settings: any = await Settings.findOne() || {};

    for (const rule of activeRules) {
        // Check if rule already ran today
        const lastRunStr = rule.lastRunDate ? rule.lastRunDate.toLocaleDateString('en-US', { timeZone: DEFAULT_SCHEDULER_TIMEZONE }) : '';
        if (lastRunStr === todayStr) continue;

        // Frequency check: daily runs every day, weekly/monthly only on specific days
        const freq = rule.frequency || 'daily';
        const scheduleDays: number[] = rule.scheduleDays || [];

        if (freq === 'weekly' && scheduleDays.length > 0) {
            // JS getDay: 0=Sun, convert: Mon=1..Sun=7
            const jsDay = now.getDay(); // 0-6
            const isoDay = jsDay === 0 ? 7 : jsDay; // 1-7 (Mon-Sun)
            if (!scheduleDays.includes(isoDay)) continue;
        } else if (freq === 'monthly' && scheduleDays.length > 0) {
            const dayOfMonth = now.getDate(); // 1-31
            if (!scheduleDays.includes(dayOfMonth)) continue;
        }

        // Determine targets based on targetRole
        let targetPhones: string[] = [];
        if (rule.targetRole === 'owner' && settings.waOwnerNumber) targetPhones.push(settings.waOwnerNumber);
        if (rule.targetRole === 'admin' && settings.waAdminNumber) targetPhones.push(settings.waAdminNumber);

        // Time check: all automations match their scheduleTime
        if (rule.scheduleTime && rule.scheduleTime !== currentHourMin) continue;

        try {
            if (rule.category === 'daily_report') {
                if (targetPhones.length === 0) continue;
                
                // Get today's total revenue from CashSession
                const startOfDay = new Date(now);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(now);
                endOfDay.setHours(23, 59, 59, 999);

                const sessions = await CashSession.find({
                    openedAt: { $gte: startOfDay, $lte: endOfDay }
                });

                let totalRevenue = 0;
                sessions.forEach((s: any) => {
                    totalRevenue += (s.expectedClosingCash || 0) - (s.openingCash || 0);
                });

                const formattedRevenue = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalRevenue);
                const message = rule.messageTemplate.replace(/{{total_revenue}}/gi, formattedRevenue);

                for (const phone of targetPhones) {
                    await sendWhatsApp(phone, message);
                    await new Promise(r => setTimeout(r, 2000));
                }

                rule.lastRunDate = now;
                await rule.save();
            }
            else if (rule.category === 'stock_alert') {
                if (targetPhones.length === 0) continue;

                // Find low stock products
                const products = await Product.find({ stock: { $lte: 5 } }).lean();
                if (products.length === 0) {
                    // No low stock, skip running (we update lastRunDate so it doesn't try again today)
                    rule.lastRunDate = now;
                    await rule.save();
                    continue;
                }

                const itemList = products.map((p: any) => `- ${p.name} (Sisa: ${p.stock})`).join('\n');
                const message = rule.messageTemplate.replace(/{{items}}/gi, itemList);

                for (const phone of targetPhones) {
                    await sendWhatsApp(phone, message);
                    await new Promise(r => setTimeout(r, 2000));
                }

                rule.lastRunDate = now;
                await rule.save();
            }
            else if (rule.category === 'membership_expiry' && rule.targetRole === 'customer') {
                const daysBefore = rule.daysBefore || 0;
                const targetDate = new Date(now);
                targetDate.setDate(targetDate.getDate() + daysBefore);
                
                const startOfTarget = new Date(targetDate);
                startOfTarget.setHours(0, 0, 0, 0);
                const endOfTarget = new Date(targetDate);
                endOfTarget.setHours(23, 59, 59, 999);

                const customers = await Customer.find({
                    membershipExpiry: { $gte: startOfTarget, $lte: endOfTarget },
                    waNotifEnabled: true,
                    phone: { $exists: true, $ne: '' }
                });

                for (const customer of customers) {
                    const msg = rule.messageTemplate.replace(/{{nama_customer}}/gi, customer.name);
                    await sendWhatsApp(customer.phone, msg);
                    await new Promise(r => setTimeout(r, 2000));
                }

                rule.lastRunDate = now;
                await rule.save();
            }
            else if (rule.category === 'birthday' && rule.targetRole === 'customer') {
                const startOfToday = new Date(now);
                startOfToday.setHours(0, 0, 0, 0);
                const endOfToday = new Date(now);
                endOfToday.setHours(23, 59, 59, 999);

                // For birthday we match Month and Day
                const month = now.getMonth() + 1;
                const day = now.getDate();

                const customers = await Customer.find({
                    waNotifEnabled: true,
                    phone: { $exists: true, $ne: '' }
                });

                // Filter in memory for birthdays today
                const birthdayCustomers = customers.filter(c => {
                    if (!c.birthday) return false;
                    const bMonth = c.birthday.getMonth() + 1;
                    const bDay = c.birthday.getDate();
                    return bMonth === month && bDay === day;
                });

                for (const customer of birthdayCustomers) {
                    const msg = rule.messageTemplate.replace(/{{nama_customer}}/gi, customer.name);
                    await sendWhatsApp(customer.phone, msg);
                    await new Promise(r => setTimeout(r, 2000));
                }

                rule.lastRunDate = now;
                await rule.save();
            }
            // Add package_expiry implementation if PackageOrder exists in future
        } catch (e) {
            console.error('Automation error:', e);
        }
    }
}

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

    let sent = 0;
    let failed = 0;

    for (const schedule of schedules) {
        try {
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
            const selectedServiceName = String((schedule as any).serviceName || '').trim();

            const message = fillTemplate(template.message, {
                nama_customer: String(customer?.name || 'Pelanggan'),
                nama_service: selectedServiceName || (serviceNames.length > 0 ? serviceNames.join(', ') : 'Layanan'),
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

    const configuredCron = String(process.env.WA_SCHEDULER_CRON || DEFAULT_SCHEDULER_CRON).trim();
    const schedulerCron = cron.validate(configuredCron) ? configuredCron : DEFAULT_SCHEDULER_CRON;

    cron.schedule(
        schedulerCron,
        async () => {
            await processPendingWaSchedules();
            await processPendingCampaigns();
            await processAutomations();
        },
        {
            timezone: schedulerTimezone,
        }
    );

    schedulerStarted = true;
}
