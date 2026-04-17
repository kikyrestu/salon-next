
import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    category: string;
    brand?: string;
    description?: string;
    price: number; // Retail Price
    costPrice: number;
    stock: number;
    alertQuantity: number;
    sku?: string;
    barcode?: string;
    type: 'retail' | 'internal';
    image?: string;
    supplier?: mongoose.Types.ObjectId;
    status: 'active' | 'inactive';
}

const productSchema = new Schema<IProduct>(
    {
        name: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        brand: { type: String, trim: true },
        description: { type: String, trim: true },
        price: { type: Number, required: true, min: 0 },
        costPrice: { type: Number, required: true, min: 0 },
        stock: { type: Number, default: 0 },
        alertQuantity: { type: Number, default: 5 },
        sku: { type: String, trim: true, unique: true, sparse: true },
        barcode: { type: String, trim: true },
        type: {
            type: String,
            enum: ['retail', 'internal'],
            default: 'retail',
        },
        image: { type: String },
        supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    { timestamps: true }
);

// Optimize query performance
productSchema.index({ status: 1, type: 1 });
productSchema.index({ category: 1 });

export default mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);
