import mongoose, { Document, Schema } from 'mongoose';

export interface IWaFollowUpContact extends Document {
    phoneNumber: string;
    isActive: boolean;
    lastTransactionId?: mongoose.Types.ObjectId;
    lastSource?: 'pos' | 'appointment' | 'other';
    lastSeenAt?: Date;
}

const waFollowUpContactSchema = new Schema<IWaFollowUpContact>(
    {
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            required: true,
        },
        lastTransactionId: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
        },
        lastSource: {
            type: String,
            enum: ['pos', 'appointment', 'other'],
            default: 'pos',
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

waFollowUpContactSchema.index({ phoneNumber: 1 }, { unique: true });
waFollowUpContactSchema.index({ isActive: 1, updatedAt: -1 });

export default mongoose.models.WaFollowUpContact || mongoose.model<IWaFollowUpContact>('WaFollowUpContact', waFollowUpContactSchema);
