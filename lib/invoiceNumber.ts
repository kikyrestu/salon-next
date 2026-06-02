import { getTenantModels } from './tenantDb';

export async function generateInvoiceNumber(tenantSlug: string): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `INV-${year}`;

    const models = await getTenantModels(tenantSlug);
    const Counter = models.Counter as any;
    const Invoice = models.Invoice as any;

    const existing = await Counter.findOne({ _id: counterId }).lean();
    
    // Auto-sync: Cari invoice terakhir tahun ini di database untuk sinkronisasi paksa jika tertinggal
    const lastInvoice = await Invoice.findOne({
        invoiceNumber: { $regex: `^INV-${year}-` }
    }).sort({ invoiceNumber: -1 }).lean();

    let maxDbSeq = 0;
    if (lastInvoice?.invoiceNumber) {
        const match = lastInvoice.invoiceNumber.match(/INV-\d{4}-(\d+)$/);
        if (match) maxDbSeq = parseInt(match[1], 10);
    }

    // Jika Counter belum ada ATAU nilainya lebih kecil dari maxDbSeq (karena bypass dari sistem lama),
    // kita set ke maxDbSeq agar tidak terjadi duplicate key error
    if (!existing || (existing.seq || 0) < maxDbSeq) {
        await Counter.findOneAndUpdate(
            { _id: counterId },
            { $set: { seq: maxDbSeq } },
            { upsert: true }
        );
    }

    const result = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, lean: true }
    );

    const seq: number = result?.seq ?? 1;
    return `INV-${year}-${seq.toString().padStart(5, '0')}`;
}