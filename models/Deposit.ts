
import mongoose, { Schema, Document } from 'mongoose';

export interface IDeposit extends Document {
    invoice: mongoose.Types.ObjectId;
    customer: mongoose.Types.ObjectId;
    amount: number;
    paymentMethod: string;
    date: Date;
    notes?: string;
    provider?: string;
    externalRef?: string;
    metadata?: Record<string, unknown>;
}

const depositSchema = new Schema<IDeposit>(
    {
        invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
        customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
        amount: { type: Number, required: true },
        paymentMethod: { type: String, required: true, default: 'Cash' },
        date: { type: Date, default: Date.now },
        notes: String,
        provider: String,
        externalRef: { type: String, index: true, sparse: true },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export default mongoose.models.Deposit || mongoose.model<IDeposit>('Deposit', depositSchema);
