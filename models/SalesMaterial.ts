import mongoose, { Schema, Document } from "mongoose";

export interface ISalesMaterial extends Document {
  name: string;
  code: string;
  description?: string;
  price: number;
  image?: string;
  isActive: boolean;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
}

const salesMaterialSchema = new Schema<ISalesMaterial>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String },
    isActive: { type: Boolean, default: true },
    commissionType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "fixed",
    },
    commissionValue: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Optimize query performance
salesMaterialSchema.index({ isActive: 1 });
salesMaterialSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.SalesMaterial ||
  mongoose.model<ISalesMaterial>("SalesMaterial", salesMaterialSchema);
