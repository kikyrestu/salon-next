import mongoose, { Document, Schema } from 'mongoose';

export type WaScheduleStatus = 'pending' | 'sent' | 'failed';

export interface IWaSchedule extends Document {
    customerId: mongoose.Types.ObjectId;
    transactionId: mongoose.Types.ObjectId;
    phoneNumber: string;
    templateId: mongoose.Types.ObjectId;
    serviceName?: string;
    scheduledAt: Date;
    status: WaScheduleStatus;
    repeatEveryValue?: number;
    repeatEveryUnit?: 'minute' | 'hour' | 'day';
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
        serviceName: {
            type: String,
            trim: true,
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
        repeatEveryValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        repeatEveryUnit: {
            type: String,
            enum: ['minute', 'hour', 'day'],
            default: 'day',
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
