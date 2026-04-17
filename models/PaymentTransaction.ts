import mongoose, { Document, Schema } from 'mongoose';

export type PaymentSourceType = 'invoice' | 'package_order';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface IPaymentTransaction extends Document {
  provider: 'xendit';
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId;
  customer?: mongoose.Types.ObjectId;
  externalId: string;
  xenditInvoiceId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  paymentMethod?: string;
  paidAmount?: number;
  paidAt?: Date;
  processedEventKeys: string[];
  lastWebhookPayload?: Record<string, unknown>;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    provider: {
      type: String,
      enum: ['xendit'],
      default: 'xendit',
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['invoice', 'package_order'],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    externalId: { type: String, required: true, unique: true },
    xenditInvoiceId: { type: String, index: true, sparse: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'IDR' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired'],
      default: 'pending',
      required: true,
    },
    checkoutUrl: { type: String },
    paymentMethod: { type: String },
    paidAmount: { type: Number },
    paidAt: { type: Date },
    processedEventKeys: { type: [String], default: [] },
    lastWebhookPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ sourceType: 1, sourceId: 1 });
paymentTransactionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.PaymentTransaction ||
  mongoose.model<IPaymentTransaction>('PaymentTransaction', paymentTransactionSchema);
