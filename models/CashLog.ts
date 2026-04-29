import mongoose, { Schema, Document } from 'mongoose';

export type CashLocation = 'kasir' | 'brankas' | 'bank' | 'owner' | 'customer' | 'expense' | 'system';
export type CashTransactionType = 'sale' | 'expense' | 'transfer' | 'adjustment' | 'open_session' | 'close_session';

export interface ICashLog extends Document {
    date: Date;
    type: CashTransactionType;
    amount: number;
    sourceLocation: CashLocation;
    destinationLocation: CashLocation;
    performedBy?: mongoose.Types.ObjectId;
    description: string;
    referenceModel?: 'Invoice' | 'Expense' | 'CashSession' | 'Deposit';
    referenceId?: mongoose.Types.ObjectId;
    balanceAfter: {
        kasir: number;
        brankas: number;
        bank: number;
    };
}

const cashLogSchema = new Schema<ICashLog>({
    date: { type: Date, default: Date.now },
    type: { 
        type: String, 
        enum: ['sale', 'expense', 'transfer', 'adjustment', 'open_session', 'close_session'],
        required: true 
    },
    amount: { type: Number, required: true },
    sourceLocation: { 
        type: String, 
        enum: ['kasir', 'brankas', 'bank', 'owner', 'customer', 'expense', 'system'],
        required: true 
    },
    destinationLocation: { 
        type: String, 
        enum: ['kasir', 'brankas', 'bank', 'owner', 'customer', 'expense', 'system'],
        required: true 
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, required: true },
    referenceModel: { type: String, enum: ['Invoice', 'Expense', 'CashSession', 'Deposit'] },
    referenceId: { type: Schema.Types.ObjectId },
    balanceAfter: {
        kasir: { type: Number, default: 0 },
        brankas: { type: Number, default: 0 },
        bank: { type: Number, default: 0 },
    }
}, { timestamps: true });

// Optimize for queries by date and location
cashLogSchema.index({ date: -1 });
cashLogSchema.index({ sourceLocation: 1, destinationLocation: 1 });
cashLogSchema.index({ referenceModel: 1, referenceId: 1 });

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.CashLog;
}

export default mongoose.models.CashLog || mongoose.model<ICashLog>('CashLog', cashLogSchema);
