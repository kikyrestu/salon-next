import { getTenantModels } from './tenantDb';

/**
 * generateInvoiceNumber — atomic invoice number generator.
 *
 * Menggunakan MongoDB findOneAndUpdate dengan $inc untuk memastikan
 * tidak ada race condition meski ada concurrent requests.
 *
 * Format output: INV-{year}-{seq padded 5 digit}
 * Contoh: INV-2026-00042
 *
 * Counter di-reset otomatis per tahun karena key-nya menyertakan year.
 * Tidak perlu cron reset — setiap tahun baru otomatis mulai dari 1.
 */
export async function generateInvoiceNumber(tenantSlug: string): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `INV-${year}`;

    const { Counter } = await getTenantModels(tenantSlug);

    // Atomic increment — dijamin tidak duplikat meski ribuan concurrent request
    const result = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );

    return `INV-${year}-${result.seq.toString().padStart(5, '0')}`;
}