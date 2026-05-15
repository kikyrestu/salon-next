import mongoose, { Schema } from 'mongoose';

/**
 * FLOW-04 FIX: Shared dedup log antara scheduler dan cron routes.
 * Mencegah duplikasi pesan ketika keduanya aktif di VPS.
 *
 * Setiap kali scheduler ATAU cron route selesai menjalankan suatu tugas,
 * ia mencatat entry di sini. Sebelum jalan, ia cek dulu apakah tugas
 * sudah dijalankan hari ini (WIB).
 */

export interface ICronDedup {
    taskType: string;    // 'daily_report' | 'stock_alert' | 'membership_expiry' | 'package_expiry' | 'birthday'
    tenantSlug: string;
    ranAt: Date;
    ranBy: 'scheduler' | 'cron_route';
}

const cronDedupSchema = new Schema<ICronDedup>(
    {
        taskType: { type: String, required: true },
        tenantSlug: { type: String, required: true, default: 'pusat' },
        ranAt: { type: Date, required: true, default: Date.now },
        ranBy: { type: String, required: true, enum: ['scheduler', 'cron_route'] },
    },
    { timestamps: false }
);

// Composite index untuk lookup cepat
cronDedupSchema.index({ taskType: 1, tenantSlug: 1, ranAt: 1 });

// TTL: auto-delete setelah 2 hari (tidak perlu simpan lama)
cronDedupSchema.index({ ranAt: 1 }, { expireAfterSeconds: 2 * 24 * 3600 });

export const CronDedup = mongoose.models.CronDedup || mongoose.model<ICronDedup>('CronDedup', cronDedupSchema);

/**
 * Cek apakah task tertentu sudah dijalankan hari ini (WIB).
 * Return true jika SUDAH jalan (harus skip), false jika belum.
 */
export async function hasRunToday(taskType: string, tenantSlug: string = 'pusat'): Promise<boolean> {
    const tz = 'Asia/Jakarta';
    const now = new Date();
    const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(now);
    const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(now);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(now);
    const todayStartWIB = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000+07:00`);

    const existing = await CronDedup.findOne({
        taskType,
        tenantSlug,
        ranAt: { $gte: todayStartWIB },
    });

    return !!existing;
}

/**
 * Catat bahwa task ini sudah berjalan. Panggil setelah task selesai.
 */
export async function markAsRun(taskType: string, tenantSlug: string = 'pusat', ranBy: 'scheduler' | 'cron_route' = 'cron_route'): Promise<void> {
    await CronDedup.create({
        taskType,
        tenantSlug,
        ranAt: new Date(),
        ranBy,
    });
}
