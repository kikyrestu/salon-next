
import mongoose, { Schema, Document } from 'mongoose';

export interface IUsageLog extends Document {
    date: Date;
    product: mongoose.Types.ObjectId;
    quantity: number;
    reason: string; // e.g. "Service", "Damaged", "Expired", "Internal Use"
    staff?: mongoose.Types.ObjectId;
    notes?: string;
    recordedBy?: mongoose.Types.ObjectId;
}

const usageLogSchema = new Schema<IUsageLog>(
    {
        date: { type: Date, default: Date.now },
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        reason: { type: String, required: true, trim: true },
        staff: { type: Schema.Types.ObjectId, ref: 'Staff' },
        notes: { type: String, trim: true },
        recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

export default mongoose.models.UsageLog || mongoose.model<IUsageLog>('UsageLog', usageLogSchema);
