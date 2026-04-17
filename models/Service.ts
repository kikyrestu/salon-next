
import mongoose, { Schema, Document } from 'mongoose';

export interface IService extends Document {
    name: string;
    category: mongoose.Types.ObjectId;
    description?: string;
    duration: number; // in minutes
    price: number;
    gender: 'male' | 'female' | 'unisex';
    image?: string;
    commissionType: 'percentage' | 'fixed';
    commissionValue: number;
    waFollowUp?: {
        enabled: boolean;
        firstDays: number;
        secondDays: number;
        firstTemplateId?: mongoose.Types.ObjectId;
        secondTemplateId?: mongoose.Types.ObjectId;
    };
    status: 'active' | 'inactive';
}

const serviceSchema = new Schema<IService>(
    {
        name: { type: String, required: true, trim: true },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'ServiceCategory',
            required: true,
        },
        description: { type: String, trim: true },
        duration: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        gender: {
            type: String,
            enum: ['male', 'female', 'unisex'],
            default: 'unisex',
        },
        image: { type: String },
        commissionType: {
            type: String,
            enum: ['percentage', 'fixed'],
            default: 'fixed',
        },
        commissionValue: { type: Number, default: 0 },
        waFollowUp: {
            enabled: { type: Boolean, default: false },
            firstDays: { type: Number, default: 0, min: 0 },
            secondDays: { type: Number, default: 0, min: 0 },
            firstTemplateId: { type: Schema.Types.ObjectId, ref: 'WaTemplate' },
            secondTemplateId: { type: Schema.Types.ObjectId, ref: 'WaTemplate' },
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    { timestamps: true }
);

export default mongoose.models.Service || mongoose.model<IService>('Service', serviceSchema);
