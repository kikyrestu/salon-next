import mongoose, { Model } from 'mongoose';
import { getTenantModels } from '@/lib/tenantDb';
import { normalizeIndonesianPhone } from '@/lib/phone';
import type { IInvoice } from '@/models/Invoice';
import type { ICustomer } from '@/models/Customer';
import type { IService } from '@/models/Service';
import type { IWaSchedule } from '@/models/WaSchedule';

interface ServiceWithFollowUp {
    _id: mongoose.Types.ObjectId;
    waFollowUp?: {
        enabled?: boolean;
        firstDays?: number;
        secondDays?: number;
        firstDelayValue?: number;
        firstDelayUnit?: 'minute' | 'hour' | 'day';
        secondDelayValue?: number;
        secondDelayUnit?: 'minute' | 'hour' | 'day';
        firstTemplateId?: mongoose.Types.ObjectId;
        secondTemplateId?: mongoose.Types.ObjectId;
    };
}

const asObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
    if (!value) return undefined;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
        return new mongoose.Types.ObjectId(value);
    }
    return undefined;
};

const addDelay = (baseDate: Date, delayValue: number, delayUnit: 'minute' | 'hour' | 'day'): Date => {
    const scheduled = new Date(baseDate);

    if (delayUnit === 'minute') {
        scheduled.setMinutes(scheduled.getMinutes() + delayValue);
        return scheduled;
    }

    if (delayUnit === 'hour') {
        scheduled.setHours(scheduled.getHours() + delayValue);
        return scheduled;
    }

    scheduled.setDate(scheduled.getDate() + delayValue);
    return scheduled;
};

export async function scheduleFollowUp(transactionId: string | mongoose.Types.ObjectId, tenantSlug: string): Promise<number> {
    const models = await getTenantModels(tenantSlug);
    const rawModels = models as any;
    const Invoice = rawModels.Invoice as Model<IInvoice>;
    const Customer = rawModels.Customer as Model<ICustomer>;
    const Service = rawModels.Service as Model<IService>;
    const WaSchedule = rawModels.WaSchedule as Model<IWaSchedule>;

    const invoice = await Invoice.findById(transactionId).lean<any>();
    if (!invoice) return 0;

    const invoiceId = asObjectId(invoice._id);
    if (!invoiceId) return 0;

    const customerId = asObjectId(invoice.customer);
    if (!customerId) return 0;

    const phoneNumber = normalizeIndonesianPhone(invoice.followUpPhoneNumber || invoice.customerPhone);

    // Fallback to customer phone from relation if invoice doesn't store phone directly.
    let finalPhone = phoneNumber;
    if (!finalPhone) {
        const customerDoc = await Customer.findById(customerId).select('phone').lean<any>();
        finalPhone = normalizeIndonesianPhone(customerDoc?.phone);
    }

    if (!finalPhone) return 0;

    const rawItems: any[] = Array.isArray(invoice.items) ? invoice.items : [];
    const serviceItems: { serviceId: string; serviceName: string; lineAmount: number; lineIndex: number }[] = rawItems
        .map((item: any, index: number) => ({ item, index }))
        .filter((entry: { item: any; index: number }) => entry.item?.itemModel === 'Service' && entry.item?.item)
        .map((entry: { item: any; index: number }) => {
            const item = entry.item;
            const index = entry.index;
            const price = Number(item?.price || 0);
            const quantity = Number(item?.quantity || 1);
            const total = Number(item?.total || 0);
            const lineAmount = Number.isFinite(total) && total > 0 ? total : (price * quantity);

            return {
                serviceId: String(item.item),
                serviceName: String(item?.name || '').trim(),
                lineAmount,
                lineIndex: index,
            };
        });

    if (serviceItems.length === 0) return 0;

    const uniqueServiceIds = Array.from(new Set<string>(serviceItems.map((item) => item.serviceId)))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (uniqueServiceIds.length === 0) return 0;

    const services = await Service.find({ _id: { $in: uniqueServiceIds } })
        .select('_id waFollowUp')
        .lean<ServiceWithFollowUp[]>();

    const createdAtBase = invoice.date ? new Date(invoice.date) : new Date();
    const eligibleCandidates: {
        serviceId: string;
        serviceName: string;
        lineAmount: number;
        lineIndex: number;
        delayValue: number;
        delayUnit: 'minute' | 'hour' | 'day';
        templateId: mongoose.Types.ObjectId;
    }[] = [];

    for (const item of serviceItems) {
        const service = services.find((entry) => String(entry._id) === item.serviceId);
        if (!service?.waFollowUp?.enabled) continue;

        const firstDelayUnit = service.waFollowUp.firstDelayUnit || 'day';
        const firstDelayValue = Number(service.waFollowUp.firstDelayValue ?? service.waFollowUp.firstDays ?? 0);
        const firstTemplateId = asObjectId(service.waFollowUp.firstTemplateId);

        if (!firstTemplateId || firstDelayValue <= 0) continue;

        eligibleCandidates.push({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            lineAmount: item.lineAmount,
            lineIndex: item.lineIndex,
            delayValue: firstDelayValue,
            delayUnit: firstDelayUnit,
            templateId: firstTemplateId,
        });
    }

    if (eligibleCandidates.length === 0) return 0;

    eligibleCandidates.sort((a, b) => {
        if (b.lineAmount !== a.lineAmount) return b.lineAmount - a.lineAmount;
        return a.lineIndex - b.lineIndex;
    });

    const selected = eligibleCandidates[0];

    const pendingDocs: {
        customerId: mongoose.Types.ObjectId;
        transactionId: mongoose.Types.ObjectId;
        phoneNumber: string;
        templateId: mongoose.Types.ObjectId;
        serviceName?: string;
        scheduledAt: Date;
        status: 'pending';
        repeatEveryValue: number;
        repeatEveryUnit: 'minute' | 'hour' | 'day';
    }[] = [
            {
                customerId,
                transactionId: invoiceId,
                phoneNumber: finalPhone,
                templateId: selected.templateId,
                serviceName: selected.serviceName,
                scheduledAt: addDelay(createdAtBase, selected.delayValue, selected.delayUnit),
                status: 'pending',
                repeatEveryValue: 0,
                repeatEveryUnit: selected.delayUnit,
            },
        ];

    const failedDocs: {
        customerId: mongoose.Types.ObjectId;
        transactionId: mongoose.Types.ObjectId;
        phoneNumber: string;
        templateId: mongoose.Types.ObjectId;
        serviceName?: string;
        scheduledAt: Date;
        status: 'failed';
        repeatEveryValue: number;
        repeatEveryUnit: 'minute' | 'hour' | 'day';
        sentAt: Date;
    }[] = eligibleCandidates.slice(1).map((candidate, index) => ({
        customerId,
        transactionId: invoiceId,
        phoneNumber: finalPhone,
        templateId: candidate.templateId,
        serviceName: candidate.serviceName,
        // Keep unique timestamp to avoid unique index collision for equal template/delay setups.
        scheduledAt: new Date(createdAtBase.getTime() + index + 1),
        status: 'failed',
        repeatEveryValue: 0,
        repeatEveryUnit: candidate.delayUnit,
        sentAt: new Date(),
    }));

    // Cek existing schedule untuk transaksi ini — hindari konflik unique index
    // tanpa perlu utak-atik DB. Filter hanya template yang belum ada di DB.
    const existingSchedules = await WaSchedule.find({
        transactionId: invoiceId,
        templateId: { $in: [...pendingDocs, ...failedDocs].map(d => d.templateId) },
    }).select('templateId scheduledAt').lean<any[]>();

    const existingKeys = new Set(
        existingSchedules.map((s: any) =>
            `${String(s.templateId)}_${new Date(s.scheduledAt).getTime()}`
        )
    );

    const docsToInsert = [...pendingDocs, ...failedDocs].filter(doc =>
        !existingKeys.has(`${String(doc.templateId)}_${doc.scheduledAt.getTime()}`)
    );

    if (docsToInsert.length === 0) return 0;

    // ordered: false supaya sisa dokumen tetap masuk meski satu gagal (race condition).
    await WaSchedule.insertMany(docsToInsert, { ordered: false }).catch((error: any) => {
        if (error?.code !== 11000) {
            throw error;
        }
    });

    return docsToInsert.length;
}