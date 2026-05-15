import mongoose, { Document, Schema } from 'mongoose';

export interface IWaCampaignQueue extends Document {
    campaignName: string;
    message: string;
    scheduledAt: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'partially_failed';
    filters: {
        lastVisitSince?: Date;
        serviceIds?: mongoose.Types.ObjectId[];
        membershipTiers?: string[];
        birthdayMonth?: number;
    };
    targets: {
        customerId: mongoose.Types.ObjectId;
        phone: string;
        status: 'pending' | 'sent' | 'failed';
        error?: string;
        sentAt?: Date;
    }[];
    processingAt?: Date;
    sentBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const waCampaignQueueSchema = new Schema<IWaCampaignQueue>(
    {
        campaignName: { type: String, required: true, trim: true },
        message: { type: String, required: true },
        scheduledAt: { type: Date, required: true },
        status: { 
            type: String, 
            enum: ['pending', 'processing', 'completed', 'failed', 'partially_failed'], 
            default: 'pending' 
        },
        filters: {
            lastVisitSince: { type: Date },
            serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
            membershipTiers: [{ type: String }],
            birthdayMonth: { type: Number },
        },
        targets: [
            {
                customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
                phone: { type: String },
                status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
                error: { type: String },
                sentAt: { type: Date },
            },
        ],
        processingAt: { type: Date },
        sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

waCampaignQueueSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.models.WaCampaignQueue || mongoose.model<IWaCampaignQueue>('WaCampaignQueue', waCampaignQueueSchema);
