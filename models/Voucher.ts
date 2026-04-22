import mongoose, { Schema, Document } from "mongoose";

export interface IVoucher extends Document {
  code: string;
  description?: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  minPurchase: number;
  maxDiscount?: number; // cap for percentage type
  expiresAt?: Date;
  usageLimit: number; // 0 = unlimited
  usedCount: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  usedBy: mongoose.Types.ObjectId[]; // customer IDs who used it
}

const voucherSchema = new Schema<IVoucher>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: { type: String, trim: true },
    discountType: {
      type: String,
      enum: ["flat", "percentage"],
      required: true,
      default: "flat",
    },
    discountValue: { type: Number, required: true, min: 0 },
    minPurchase: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    expiresAt: { type: Date },
    usageLimit: { type: Number, default: 1, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    usedBy: [{ type: Schema.Types.ObjectId, ref: "Customer" }],
  },
  { timestamps: true },
);

voucherSchema.index({ isActive: 1 });
voucherSchema.index({ expiresAt: 1 });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Voucher;
}

export default mongoose.models.Voucher ||
  mongoose.model<IVoucher>("Voucher", voucherSchema);
