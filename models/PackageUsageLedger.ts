import mongoose, { Document, Schema } from 'mongoose';

export interface IPackageUsageLedger extends Document {
  customer: mongoose.Types.ObjectId;
  customerPackage: mongoose.Types.ObjectId;
  package: mongoose.Types.ObjectId;
  service: mongoose.Types.ObjectId;
  serviceName: string;
  quantity: number;
  invoice?: mongoose.Types.ObjectId;
  sourceType: 'package_redeem';
  note?: string;
  usedAt: Date;
}

const packageUsageLedgerSchema = new Schema<IPackageUsageLedger>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerPackage: { type: Schema.Types.ObjectId, ref: 'CustomerPackage', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'ServicePackage', required: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    sourceType: { type: String, enum: ['package_redeem'], default: 'package_redeem', required: true },
    note: { type: String },
    usedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

packageUsageLedgerSchema.index({ customer: 1, usedAt: -1 });
packageUsageLedgerSchema.index({ customerPackage: 1, service: 1, usedAt: -1 });

export default mongoose.models.PackageUsageLedger ||
  mongoose.model<IPackageUsageLedger>('PackageUsageLedger', packageUsageLedgerSchema);
