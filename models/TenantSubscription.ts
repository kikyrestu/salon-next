import mongoose, { Schema } from 'mongoose';
import { SaasBillingPeriod, SaasLimitType } from './SaasPlan';

// planSnapshot disimpan biar histori subscription gak ikut berubah kalau admin edit
// SaasPlan-nya belakangan (misal ganti nama/limit paket setelah tenant udah subscribe).

export type TenantSubscriptionStatus = 'active' | 'expired' | 'suspended' | 'pending_payment';

export interface ITenantSubscriptionAddOn {
    _id?: string;
    name: string;
    limitType: SaasLimitType;
    extraAmount: number;
    price: number;
    purchasedAt: Date;
    expiresAt: Date; // add-on ikut habis pas periode subscription-nya abis
}

export interface ITenantSubscription {
    _id: string;
    storeId: mongoose.Types.ObjectId;
    planId: mongoose.Types.ObjectId;
    planSnapshot: {
        name: string;
        code: string;
        limits: {
            maxStaff: number;
            maxTransactionsPerMonth: number;
            maxWaMessagesPerMonth: number;
        };
    };
    billingPeriod: SaasBillingPeriod;
    pricePaid: number;
    status: TenantSubscriptionStatus;
    startDate: Date;
    expiresAt: Date;
    activeAddOns: ITenantSubscriptionAddOn[];
    lastXenditInvoiceId?: string; // buat nyambungin ke lib/xendit.ts invoice type 'saas_subscription'
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const TenantSubscriptionAddOnSchema = new Schema<ITenantSubscriptionAddOn>(
    {
        name: { type: String, required: true, trim: true },
        limitType: {
            type: String,
            enum: ['staff', 'transaction', 'wa'],
            required: true,
        },
        extraAmount: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        purchasedAt: { type: Date, required: true, default: Date.now },
        expiresAt: { type: Date, required: true },
    }
);

export const TenantSubscriptionSchema = new Schema<ITenantSubscription>(
    {
        storeId: {
            type: Schema.Types.ObjectId,
            ref: 'Store',
            required: true,
            index: true,
        },
        planId: {
            type: Schema.Types.ObjectId,
            ref: 'SaasPlan',
            required: true,
        },
        planSnapshot: {
            name: { type: String, required: true },
            code: { type: String, required: true },
            limits: {
                maxStaff: { type: Number, required: true },
                maxTransactionsPerMonth: { type: Number, required: true },
                maxWaMessagesPerMonth: { type: Number, required: true },
            },
        },
        billingPeriod: {
            type: String,
            enum: ['monthly', 'semiannual', 'annual'],
            required: true,
        },
        pricePaid: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'suspended', 'pending_payment'],
            default: 'pending_payment',
            index: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        activeAddOns: {
            type: [TenantSubscriptionAddOnSchema],
            default: [],
        },
        lastXenditInvoiceId: {
            type: String,
            trim: true,
        },
        autoRenew: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Satu store cuma boleh punya satu subscription yang lagi 'active' dalam satu waktu -
// histori lama biarin nambah row baru tiap ganti/renewal, jangan di-overwrite in-place,
// biar ada jejak billing (dan gampang dipakai buat laporan admin panel PHP nanti).
TenantSubscriptionSchema.index({ storeId: 1, status: 1 });

export default TenantSubscriptionSchema;
