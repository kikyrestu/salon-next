import mongoose, { Document, Schema } from 'mongoose';

export interface IWaBlastLog extends Document {
    campaignName: string;
    message: string;
    targetCount: number;
    sentCount: number;
    failedCount: number;
    filters: {
        lastVisitSince?: Date;
        serviceIds?: mongoose.Types.ObjectId[];
        membershipTiers?: string[];
        birthdayMonth?: number;
    };
    recipients: {
        customerId: mongoose.Types.ObjectId;
        phone: string;
        status: 'sent' | 'failed';
        error?: string;
    }[];
    sentBy: mongoose.Types.ObjectId;
    createdAt: Date;
}

const waBlastLogSchema = new Schema<IWaBlastLog>(
    {
        campaignName: { type: String, required: true, trim: true },
        message: { type: String, required: true },
        targetCount: { type: Number, default: 0 },
        sentCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        filters: {
            lastVisitSince: { type: Date },
            serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
            membershipTiers: [{ type: String }],
            birthdayMonth: { type: Number },
        },
        recipients: [
            {
                customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
                phone: { type: String },
                status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
                error: { type: String },
            },
        ],
        sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

waBlastLogSchema.index({ createdAt: -1 });

export default mongoose.models.WaBlastLog || mongoose.model<IWaBlastLog>('WaBlastLog', waBlastLogSchema);
