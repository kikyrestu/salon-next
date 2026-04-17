import mongoose, { Document, Schema } from 'mongoose';

export type CustomerPackageStatus = 'active' | 'depleted' | 'expired' | 'cancelled';

export interface ICustomerPackage extends Document {
  customer: mongoose.Types.ObjectId;
  package: mongoose.Types.ObjectId;
  packageName: string;
  order?: mongoose.Types.ObjectId;
  activatedAt: Date;
  expiresAt?: Date;
  status: CustomerPackageStatus;
  serviceQuotas: {
    service: mongoose.Types.ObjectId;
    serviceName: string;
    totalQuota: number;
    usedQuota: number;
    remainingQuota: number;
  }[];
}

const customerPackageSchema = new Schema<ICustomerPackage>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'ServicePackage', required: true },
    packageName: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'PackageOrder' },
    activatedAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'depleted', 'expired', 'cancelled'],
      default: 'active',
      required: true,
    },
    serviceQuotas: [
      {
        service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
        serviceName: { type: String, required: true },
        totalQuota: { type: Number, required: true, min: 0 },
        usedQuota: { type: Number, default: 0, min: 0 },
        remainingQuota: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { timestamps: true }
);

customerPackageSchema.index({ customer: 1, status: 1, activatedAt: -1 });
customerPackageSchema.index({ package: 1, status: 1 });

export default mongoose.models.CustomerPackage ||
  mongoose.model<ICustomerPackage>('CustomerPackage', customerPackageSchema);
