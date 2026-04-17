import mongoose, { Schema, Model, models } from 'mongoose';

export interface ISupplier {
    _id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    createdBy?: string;
    status: 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
    {
        name: {
            type: String,
            required: [true, 'Supplier name is required'],
            trim: true,
        },
        contactPerson: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    }
);

const Supplier = (models.Supplier as Model<ISupplier>) || mongoose.model<ISupplier>('Supplier', supplierSchema);

export default Supplier;

