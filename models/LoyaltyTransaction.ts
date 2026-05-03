import mongoose, { Schema, Document } from 'mongoose';

export interface ILoyaltyTransaction extends Document {
  customer: mongoose.Types.ObjectId;
  invoice?: mongoose.Types.ObjectId;
  points: number;
  type: 'earned' | 'redeemed' | 'adjusted';
  description: string;
  balanceAfter: number;
  date: Date;
}

const loyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    points: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['earned', 'redeemed', 'adjusted'], 
      required: true 
    },
    description: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Optimization for history queries
loyaltyTransactionSchema.index({ customer: 1, date: -1 });

if (process.env.NODE_ENV === 'development') {
  delete mongoose.models.LoyaltyTransaction;
}

export default mongoose.models.LoyaltyTransaction ||
  mongoose.model<ILoyaltyTransaction>('LoyaltyTransaction', loyaltyTransactionSchema);
