import mongoose, { Document, Schema } from 'mongoose';

export interface IServicePackage extends Document {
  name: string;
  code: string;
  description?: string;
  price: number;
  items: {
    service: mongoose.Types.ObjectId;
    serviceName: string;
    quota: number;
  }[];
  image?: string;
  isActive: boolean;
}

const servicePackageSchema = new Schema<IServicePackage>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String },
    items: [
      {
        service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
        serviceName: { type: String, required: true },
        quota: { type: Number, required: true, min: 1 },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

servicePackageSchema.index({ name: 1 });

export default mongoose.models.ServicePackage ||
  mongoose.model<IServicePackage>('ServicePackage', servicePackageSchema);
