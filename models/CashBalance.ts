import mongoose, { Schema, Document } from 'mongoose';

export interface ICashBalance extends Document {
    kasirBalance: number;
    brankasBalance: number;
    bankBalance: number;
    lastUpdatedAt: Date;
}

const cashBalanceSchema = new Schema<ICashBalance>({
    kasirBalance: { type: Number, default: 0 },
    brankasBalance: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.CashBalance;
}

export default mongoose.models.CashBalance || mongoose.model<ICashBalance>('CashBalance', cashBalanceSchema);
