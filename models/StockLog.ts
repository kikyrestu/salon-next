import mongoose, { Schema, Document } from "mongoose";

export interface IStockLog extends Document {
  product: mongoose.Types.ObjectId;
  storeSlug: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  balanceAfter: number;
  note?: string;
  performedBy?: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const stockLogSchema = new Schema<IStockLog>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    storeSlug: { type: String, required: true },
    type: { type: String, enum: ["in", "out", "adjustment"], required: true },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    note: { type: String },
    performedBy: { type: Schema.Types.Mixed }, // string or User ID
  },
  { timestamps: true },
);

stockLogSchema.index({ product: 1, createdAt: -1 });
stockLogSchema.index({ storeSlug: 1, createdAt: -1 });

export default mongoose.models.StockLog ||
  mongoose.model<IStockLog>("StockLog", stockLogSchema);
