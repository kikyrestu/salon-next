import mongoose, { Schema } from 'mongoose';

// Satu dokumen per store per periode billing berjalan. Di-reset (bikin dokumen baru)
// tiap kali TenantSubscription mulai periode baru (renewal / upgrade / downgrade).
// Enforcement logic bandingin transactionsCount/waMessagesCount di sini terhadap
// planSnapshot.limits + total activeAddOns pada TenantSubscription yang lagi aktif.

export interface ITenantUsageCounter {
    _id: string;
    storeId: mongoose.Types.ObjectId;
    subscriptionId: mongoose.Types.ObjectId;
    periodStart: Date;
    periodEnd: Date;
    transactionsCount: number;
    waMessagesCount: number;
    staffCountSnapshot: number;
    createdAt: Date;
    updatedAt: Date;
}

export const TenantUsageCounterSchema = new Schema<ITenantUsageCounter>(
    {
        storeId: {
            type: Schema.Types.ObjectId,
            ref: 'Store',
            required: true,
        },
        subscriptionId: {
            type: Schema.Types.ObjectId,
            ref: 'TenantSubscription',
            required: true,
        },
        periodStart: {
            type: Date,
            required: true,
        },
        periodEnd: {
            type: Date,
            required: true,
        },
        transactionsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        waMessagesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        staffCountSnapshot: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Satu counter per store per periode - dipakai buat $inc atomik tiap ada transaksi/WA baru.
TenantUsageCounterSchema.index({ storeId: 1, periodStart: 1 }, { unique: true });

export default TenantUsageCounterSchema;
