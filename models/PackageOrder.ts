import mongoose, { Document, Schema } from 'mongoose';

export type PackageOrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface IPackageOrder extends Document {
  orderNumber: string;
  customer: mongoose.Types.ObjectId;
  package: mongoose.Types.ObjectId;
  packageSnapshot: {
    name: string;
    code: string;
    price: number;
    items: {
      service: mongoose.Types.ObjectId;
      serviceName: string;
      quota: number;
    }[];
    validityDays?: number;
  };
  amount: number;
  discount: number;
  status: PackageOrderStatus;
  paymentTransaction?: mongoose.Types.ObjectId;
  activatedCustomerPackage?: mongoose.Types.ObjectId;
  // [BUG FIX] Staff yang menjual paket ini, dipakai untuk komisi penjualan.
  // Sebelumnya tidak ada tempat menyimpan ini sama sekali, jadi komisi
  // penjualan paket tidak pernah muncul di laporan Staff Performance / Payroll.
  sellingBy?: mongoose.Types.ObjectId;
}

const packageOrderSchema = new Schema<IPackageOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'ServicePackage', required: true },
    packageSnapshot: {
      name: { type: String, required: true },
      code: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      items: [
        {
          service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
          serviceName: { type: String, required: true },
          quota: { type: Number, required: true, min: 1 },
        },
      ],
      validityDays: { type: Number },
    },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    paymentTransaction: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction' },
    activatedCustomerPackage: { type: Schema.Types.ObjectId, ref: 'CustomerPackage' },
    sellingBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  },
  { timestamps: true }
);

packageOrderSchema.index({ customer: 1, status: 1, createdAt: -1 });

export default mongoose.models.PackageOrder ||
  mongoose.model<IPackageOrder>('PackageOrder', packageOrderSchema);
