import mongoose from 'mongoose';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Invoice from '@/models/Invoice';
import Service from '@/models/Service';
import WaSchedule from '@/models/WaSchedule';
import { normalizeIndonesianPhone } from '@/lib/phone';

interface FollowUpTemplateConfig {
    days: number;
    templateId?: mongoose.Types.ObjectId;
}

interface ServiceWithFollowUp {
    _id: mongoose.Types.ObjectId;
    waFollowUp?: {
        enabled?: boolean;
        firstDays?: number;
        secondDays?: number;
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

const addDays = (baseDate: Date, days: number): Date => {
    const scheduled = new Date(baseDate);
    scheduled.setDate(scheduled.getDate() + days);
    return scheduled;
};

export async function scheduleFollowUp(transactionId: string | mongoose.Types.ObjectId): Promise<number> {
    await connectToDB();
    initModels();

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
        const customerDoc = await mongoose.model('Customer').findById(customerId).select('phone').lean<any>();
        finalPhone = normalizeIndonesianPhone(customerDoc?.phone);
    }

    if (!finalPhone) return 0;

    const serviceItemIds: string[] = (invoice.items || [])
        .filter((item: any) => item?.itemModel === 'Service' && item?.item)
        .map((item: any) => String(item.item));

    if (serviceItemIds.length === 0) return 0;

    const uniqueServiceIds = Array.from(new Set<string>(serviceItemIds))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (uniqueServiceIds.length === 0) return 0;

    const services = await Service.find({ _id: { $in: uniqueServiceIds } })
        .select('_id waFollowUp')
        .lean<ServiceWithFollowUp[]>();

    const createdAtBase = invoice.date ? new Date(invoice.date) : new Date();
    const docsToInsert: {
        customerId: mongoose.Types.ObjectId;
        transactionId: mongoose.Types.ObjectId;
        phoneNumber: string;
        templateId: mongoose.Types.ObjectId;
        scheduledAt: Date;
        status: 'pending';
    }[] = [];

    for (const service of services) {
        const followUp = service.waFollowUp;
        if (!followUp?.enabled) continue;

        const candidates: FollowUpTemplateConfig[] = [
            { days: Number(followUp.firstDays || 0), templateId: asObjectId(followUp.firstTemplateId) },
            { days: Number(followUp.secondDays || 0), templateId: asObjectId(followUp.secondTemplateId) },
        ];

        for (const candidate of candidates) {
            if (!candidate.templateId || candidate.days <= 0) continue;

            docsToInsert.push({
                customerId,
                transactionId: invoiceId,
                phoneNumber: finalPhone,
                templateId: candidate.templateId,
                scheduledAt: addDays(createdAtBase, candidate.days),
                status: 'pending',
            });
        }
    }

    if (docsToInsert.length === 0) return 0;

    // Avoid duplicate queue rows for same transaction/template/date.
    await WaSchedule.insertMany(docsToInsert, { ordered: false }).catch((error: any) => {
        if (error?.code !== 11000) {
            throw error;
        }
    });

    return docsToInsert.length;
}
