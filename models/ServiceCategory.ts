
import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceCategory extends Document {
    name: string;
    description?: string;
    slug: string;
    status: 'active' | 'inactive';
}

const serviceCategorySchema = new Schema<IServiceCategory>(
    {
        name: { type: String, required: true, trim: true, unique: true },
        description: { type: String, trim: true },
        slug: { type: String, trim: true, unique: true },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    { timestamps: true }
);

export default mongoose.models.ServiceCategory || mongoose.model<IServiceCategory>('ServiceCategory', serviceCategorySchema);
