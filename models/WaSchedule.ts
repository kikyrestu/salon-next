import mongoose, { Document, Schema } from 'mongoose';

export type WaScheduleStatus = 'pending' | 'sent' | 'failed';

export interface IWaSchedule extends Document {
    customerId: mongoose.Types.ObjectId;
    transactionId: mongoose.Types.ObjectId;
    phoneNumber: string;
    templateId: mongoose.Types.ObjectId;
    scheduledAt: Date;
    status: WaScheduleStatus;
    sentAt?: Date;
}

const waScheduleSchema = new Schema<IWaSchedule>(
    {
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        transactionId: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },
        templateId: {
            type: Schema.Types.ObjectId,
            ref: 'WaTemplate',
            required: true,
        },
        scheduledAt: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending',
            required: true,
        },
        sentAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

waScheduleSchema.index({ status: 1, scheduledAt: 1 });
waScheduleSchema.index({ transactionId: 1, templateId: 1, scheduledAt: 1 }, { unique: true });

export default mongoose.models.WaSchedule || mongoose.model<IWaSchedule>('WaSchedule', waScheduleSchema);
