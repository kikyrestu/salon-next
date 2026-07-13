import mongoose, { Schema, Model, models } from 'mongoose';

export interface IStore {
    _id: string;
    name: string;
    slug: string;
    dbUri: string;
    isActive: boolean;
    // Cache dari TenantSubscription aktif (lihat models/TenantSubscription.ts) — di-update
    // tiap kali subscription berubah (approve, renewal, expired via cron, upgrade/downgrade),
    // biar auth.config.ts authorized() callback gak perlu join ke Master DB tiap request.
    subscriptionStatus: 'active' | 'expired' | 'suspended' | 'pending_payment' | null;
    subscriptionExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

type StoreModel = Model<IStore>;

const storeSchema = new Schema<IStore, StoreModel>(
    {
        name: {
            type: String,
            required: [true, 'Store name is required'],
            trim: true,
        },
        slug: {
            type: String,
            required: [true, 'Store slug is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^[a-z0-9-]+$/,
                'Slug can only contain lowercase letters, numbers, and hyphens',
            ],
        },
        dbUri: {
            type: String,
            required: [true, 'Database URI is required'],
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        subscriptionStatus: {
            type: String,
            enum: ['active', 'expired', 'suspended', 'pending_payment', null],
            default: null,
        },
        subscriptionExpiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// We don't export a default model bound to global mongoose here,
// because we will load it specifically on the master connection.
// But for type safety, we can export the schema.
export const StoreSchema = storeSchema;
