import mongoose, { Schema, Document } from 'mongoose';

export interface IWalletTransaction extends Document {
  customer: mongoose.Types.ObjectId;
  type: 'topup' | 'bonus' | 'payment' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  // Top-up specific
  topupMethod?: string; // Cash, Transfer, QRIS, etc.
  bonusPercent?: number;
  bonusAmount?: number;
  // Payment specific — links to invoice
  invoice?: mongoose.Types.ObjectId;
  // Who performed the transaction
  performedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: {
      type: String,
      enum: ['topup', 'bonus', 'payment', 'refund'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    // Top-up
    topupMethod: { type: String },
    bonusPercent: { type: Number, default: 0 },
    bonusAmount: { type: Number, default: 0 },
    // Payment link
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    // Performed by
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ createdAt: -1 });

export default mongoose.models.WalletTransaction ||
  mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
