import { getTenantModels } from './tenantDb';

export async function generateInvoiceNumber(tenantSlug: string): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `INV-${year}`;

    const models = await getTenantModels(tenantSlug);
    const Counter = models.Counter as any;

    const result = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, lean: true }
    );

    const seq: number = result?.seq ?? 1;
    return `INV-${year}-${seq.toString().padStart(5, '0')}`;
}