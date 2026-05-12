import cron from 'node-cron';
import { getMasterModels } from './masterDb';
import { getTenantModels } from './tenantDb';
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

/**
 * Get all active tenant slugs from the master Store collection.
 */
async function getAllTenantSlugs(): Promise<string[]> {
    try {
        const master = await getMasterModels();
        const stores = await master.Store.find({ isActive: true }).select('slug').lean();
        return stores.map((s: any) => s.slug).filter(Boolean);
    } catch (e) {
        console.error('Failed to fetch tenant slugs:', e);
        // Fallback to 'pusat' if master DB is not available
        return ['pusat'];
    }
}

/**
 * Get the Fonnte token for a given tenant.
 */
async function getTenantFonnteToken(slug: string): Promise<string> {
    try {
        const models = await getTenantModels(slug);
        const settings: any = await models.Settings.findOne({});
        if (settings?.fonnteToken) {
            return String(settings.fonnteToken).trim();
        }
    } catch (e) {
        console.error(`Failed to get fonnteToken for tenant "${slug}":`, e);
    }
    return String(process.env.FONNTE_TOKEN || '').trim();
}

export async function processPendingCampaigns(now: Date = new Date()) {
    const slugs = await getAllTenantSlugs();

    for (const slug of slugs) {
        try {
            const models = await getTenantModels(slug);
            const { WaCampaignQueue, WaBlastLog, Customer } = models;
            const token = await getTenantFonnteToken(slug);

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
                // Limit to 2 per run to avoid timeouts and keep delivery slow/safe (2 * ~30s = ~60s)
                const pendingTargets = campaign.targets.filter((t: any) => t.status === 'pending').slice(0, 2);

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
                        const result = await sendWhatsApp(target.phone, personalizedMsg, token);
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

                    // Randomized delay to avoid bot detection (20s - 40s)
                    const safeDelay = Math.floor(Math.random() * (40000 - 20000 + 1)) + 20000;
                    await new Promise((resolve) => setTimeout(resolve, safeDelay));
                }
            }
        } catch (e) {
            console.error(`processPendingCampaigns error for tenant "${slug}":`, e);
        }
    }
}

export async function processAutomations(now: Date = new Date()) {
    const slugs = await getAllTenantSlugs();

    const currentHourMin = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: DEFAULT_SCHEDULER_TIMEZONE });
    const todayStr = now.toLocaleDateString('en-US', { timeZone: DEFAULT_SCHEDULER_TIMEZONE });

    for (const slug of slugs) {
        try {
            const models = await getTenantModels(slug);
            const { WaAutomation, Settings, Customer, Product, Invoice } = models;
            const token = await getTenantFonnteToken(slug);

            const activeRules = await WaAutomation.find({ isActive: true });
            const settings: any = await Settings.findOne() || {};

            for (const rule of activeRules) {
                // Check if rule already ran today
                const lastRunStr = rule.lastRunDate ? rule.lastRunDate.toLocaleDateString('en-US', { timeZone: DEFAULT_SCHEDULER_TIMEZONE }) : '';
                if (lastRunStr === todayStr) continue;

                // Frequency check
                const freq = rule.frequency || 'daily';
                const scheduleDays: number[] = rule.scheduleDays || [];

                if (freq === 'weekly' && scheduleDays.length > 0) {
                    const jsDay = now.getDay();
                    const isoDay = jsDay === 0 ? 7 : jsDay;
                    if (!scheduleDays.includes(isoDay)) continue;
                } else if (freq === 'monthly' && scheduleDays.length > 0) {
                    const dayOfMonth = now.getDate();
                    if (!scheduleDays.includes(dayOfMonth)) continue;
                }

                // Determine targets based on targetRole
                let targetPhones: string[] = [];
                if (rule.targetRole === 'owner' && settings.waOwnerNumber) targetPhones.push(settings.waOwnerNumber);
                if (rule.targetRole === 'admin' && settings.waAdminNumber) targetPhones.push(settings.waAdminNumber);

                // Time check
                if (rule.scheduleTime && rule.scheduleTime !== currentHourMin) continue;

                try {
                    if (rule.category === 'daily_report') {
                        if (targetPhones.length === 0) continue;

                        const startOfDay = new Date(now);
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date(now);
                        endOfDay.setHours(23, 59, 59, 999);

                        const invoices = await Invoice.find({
                            date: { $gte: startOfDay, $lte: endOfDay },
                            status: 'paid',
                        }).lean();

                        const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);
                        const totalTransactions = invoices.length;
                        const totalCustomers = new Set(invoices.map((inv: any) => String(inv.customer))).size;

                        const formattedRevenue = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalRevenue);
                        const message = rule.messageTemplate
                            .replace(/{{total_revenue}}/gi, formattedRevenue)
                            .replace(/{{total_transactions?}}/gi, String(totalTransactions))
                            .replace(/{{total_customers?}}/gi, String(totalCustomers));

                        for (const phone of targetPhones) {
                            await sendWhatsApp(phone, message, token);
                            await new Promise(r => setTimeout(r, 10000));
                        }

                        rule.lastRunDate = now;
                        await rule.save();
                    }
                    else if (rule.category === 'stock_alert') {
                        if (targetPhones.length === 0) continue;

                        const products = await Product.find({
                            status: 'active',
                            lowStockAlertEnabled: true,
                            $expr: { $lte: ['$stock', '$alertQuantity'] }
                        }).lean();
                        if (products.length === 0) {
                            rule.lastRunDate = now;
                            await rule.save();
                            continue;
                        }

                        const itemList = products.map((p: any) => `- ${p.name} (Sisa: ${p.stock})`).join('\n');
                        const message = rule.messageTemplate.replace(/{{items}}/gi, itemList);

                        for (const phone of targetPhones) {
                            await sendWhatsApp(phone, message, token);
                            await new Promise(r => setTimeout(r, 10000));
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
                            await sendWhatsApp(customer.phone, msg, token);
                            await new Promise(r => setTimeout(r, 10000));
                        }

                        rule.lastRunDate = now;
                        await rule.save();
                    }
                    else if (rule.category === 'birthday' && rule.targetRole === 'customer') {
                        const month = now.getMonth() + 1;
                        const day = now.getDate();

                        const customers = await Customer.find({
                            waNotifEnabled: true,
                            phone: { $exists: true, $ne: '' }
                        });

                        const birthdayCustomers = customers.filter(c => {
                            if (!c.birthday) return false;
                            const bMonth = c.birthday.getMonth() + 1;
                            const bDay = c.birthday.getDate();
                            return bMonth === month && bDay === day;
                        });

                        for (const customer of birthdayCustomers) {
                            const msg = rule.messageTemplate.replace(/{{nama_customer}}/gi, customer.name);
                            await sendWhatsApp(customer.phone, msg, token);
                            await new Promise(r => setTimeout(r, 10000));
                        }

                        rule.lastRunDate = now;
                        await rule.save();
                    }
                } catch (e) {
                    console.error('Automation error:', e);
                }
            }
        } catch (e) {
            console.error(`processAutomations error for tenant "${slug}":`, e);
        }
    }
}

export async function processPendingWaSchedules(now: Date = new Date()): Promise<ProcessResult> {
    const slugs = await getAllTenantSlugs();
    let totalSent = 0;
    let totalFailed = 0;
    let totalCount = 0;

    for (const slug of slugs) {
        try {
            const models = await getTenantModels(slug);
            const { WaSchedule } = models;
            const token = await getTenantFonnteToken(slug);

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

            totalCount += schedules.length;

            for (const schedule of schedules) {
                try {
                    const template: any = schedule.templateId;
                    if (!template?.message) {
                        await WaSchedule.findByIdAndUpdate(schedule._id, { status: 'failed' });
                        totalFailed += 1;
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

                    const result = await sendWhatsApp(schedule.phoneNumber, message, token);

                    if (result.success) {
                        await WaSchedule.findByIdAndUpdate(schedule._id, {
                            status: 'sent',
                            sentAt: new Date(),
                        });
                        totalSent += 1;
                    } else {
                        await WaSchedule.findByIdAndUpdate(schedule._id, {
                            status: 'failed',
                        });
                        totalFailed += 1;
                    }
                } catch (error) {
                    await WaSchedule.findByIdAndUpdate(schedule._id, { status: 'failed' });
                    totalFailed += 1;
                }
            }
        } catch (e) {
            console.error(`processPendingWaSchedules error for tenant "${slug}":`, e);
        }
    }

    return {
        total: totalCount,
        sent: totalSent,
        failed: totalFailed,
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