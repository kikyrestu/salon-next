import mongoose, { Schema, Document } from 'mongoose';

export interface ICashSession extends Document {
    openedAt: Date;
    openedBy: mongoose.Types.ObjectId;
    startingCash: number;
    
    closedAt?: Date;
    closedBy?: mongoose.Types.ObjectId;
    expectedEndingCash?: number;
    actualEndingCash?: number;
    discrepancy?: number;
    
    status: 'open' | 'closed';
    notes?: string;
}

const cashSessionSchema = new Schema<ICashSession>({
    openedAt: { type: Date, required: true, default: Date.now },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startingCash: { type: Number, required: true, default: 0 },
    
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    expectedEndingCash: { type: Number },
    actualEndingCash: { type: Number },
    discrepancy: { type: Number },
    
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    notes: { type: String },
}, { timestamps: true });

// Ensure only one open session at a time
cashSessionSchema.index({ status: 1 });

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.CashSession;
}

export default mongoose.models.CashSession || mongoose.model<ICashSession>('CashSession', cashSessionSchema);
