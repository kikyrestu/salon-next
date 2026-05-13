import { getTenantModels } from './tenantDb';

export async function generateInvoiceNumber(tenantSlug: string): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `INV-${year}`;

    const { Counter } = await getTenantModels(tenantSlug);

    const result = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    ).lean() as { _id: string; seq: number } | null;

    const seq = result?.seq ?? 1;
    return `INV-${year}-${seq.toString().padStart(5, '0')}`;
}