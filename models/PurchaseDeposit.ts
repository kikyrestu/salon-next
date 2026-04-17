
import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseDeposit extends Document {
    purchase: mongoose.Types.ObjectId;
    supplier: mongoose.Types.ObjectId;
    amount: number;
    paymentMethod: string;
    date: Date;
    notes?: string;
}

const purchaseDepositSchema = new Schema<IPurchaseDeposit>(
    {
        purchase: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true },
        supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
        amount: { type: Number, required: true },
        paymentMethod: { type: String, required: true, default: 'Cash' },
        date: { type: Date, default: Date.now },
        notes: String,
    },
    { timestamps: true }
);

export default mongoose.models.PurchaseDeposit || mongoose.model<IPurchaseDeposit>('PurchaseDeposit', purchaseDepositSchema);
