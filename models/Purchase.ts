
import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchase extends Document {
    purchaseNumber: string;
    supplier: mongoose.Types.ObjectId;
    date: Date;
    status: 'pending' | 'received' | 'cancelled';
    items: {
        product: mongoose.Types.ObjectId;
        quantity: number;
        costPrice: number;
        total: number;
    }[];
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: 'paid' | 'pending' | 'partially_paid';
    paymentMethod: string;
    notes?: string;
    createdBy?: mongoose.Types.ObjectId;
}

const purchaseSchema = new Schema<IPurchase>(
    {
        purchaseNumber: { type: String, required: true, unique: true },
        supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
        date: { type: Date, default: Date.now },
        status: {
            type: String,
            enum: ['pending', 'received', 'cancelled'],
            default: 'received'
        },
        items: [{
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, required: true, min: 1 },
            costPrice: { type: Number, required: true, min: 0 },
            total: { type: Number, required: true }
        }],
        subtotal: { type: Number, required: true, default: 0 },
        tax: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true, default: 0 },
        paidAmount: { type: Number, default: 0 },
        paymentStatus: {
            type: String,
            enum: ['paid', 'pending', 'partially_paid'],
            default: 'pending'
        },
        paymentMethod: { type: String, default: 'Cash' },
        notes: String,
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

export default mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', purchaseSchema);
