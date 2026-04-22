import mongoose, { Schema, Document } from "mongoose";

export interface IServiceBundleItem {
  service: mongoose.Types.ObjectId;
  serviceName: string;
  servicePrice: number;
  duration: number;
  commissionType?: "percentage" | "fixed";
  commissionValue?: number;
}

export interface IServiceBundle extends Document {
  name: string;
  description?: string;
  price: number;
  image?: string;
  isActive: boolean;
  services: IServiceBundleItem[];
}

const ServiceBundleItemSchema = new Schema<IServiceBundleItem>(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, required: true, trim: true },
    servicePrice: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 0 },
    commissionType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "fixed",
    },
    commissionValue: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ServiceBundleSchema = new Schema<IServiceBundle>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    services: {
      type: [ServiceBundleItemSchema],
      required: true,
      validate: {
        validator: (v: IServiceBundleItem[]) => Array.isArray(v) && v.length >= 1,
        message: "Bundle harus memiliki minimal 1 jasa",
      },
    },
  },
  { timestamps: true }
);

ServiceBundleSchema.index({ isActive: 1 });
ServiceBundleSchema.index({ name: 1 });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.ServiceBundle;
}

export default mongoose.models.ServiceBundle ||
  mongoose.model<IServiceBundle>("ServiceBundle", ServiceBundleSchema);
