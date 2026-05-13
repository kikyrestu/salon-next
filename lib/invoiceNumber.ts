import { getTenantModels } from './tenantDb';

export async function generateInvoiceNumber(tenantSlug: string): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `INV-${year}`;

    const models = await getTenantModels(tenantSlug);
    const Counter = models.Counter as any;
    const Invoice = models.Invoice as any;

    // Auto-sync: cek apakah counter sudah ada
    const existing = await Counter.findOne({ _id: counterId }).lean();
    if (!existing) {
        // Counter belum ada — cari invoice terakhir tahun ini untuk sinkronisasi
        const lastInvoice = await Invoice.findOne({
            invoiceNumber: { $regex: `^INV-${year}-` }
        }).sort({ invoiceNumber: -1 }).lean();

        let startSeq = 0;
        if (lastInvoice?.invoiceNumber) {
            const match = lastInvoice.invoiceNumber.match(/INV-\d{4}-(\d+)$/);
            if (match) startSeq = parseInt(match[1], 10);
        }

        // Upsert dengan startSeq agar tidak mulai dari 0
        if (startSeq > 0) {
            await Counter.findOneAndUpdate(
                { _id: counterId },
                { $setOnInsert: { seq: startSeq } },
                { upsert: true }
            );
        }
    }

    const result = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, lean: true }
    );

    const seq: number = result?.seq ?? 1;
    return `INV-${year}-${seq.toString().padStart(5, '0')}`;
}