import mongoose, { Schema, Model } from 'mongoose';

export interface IRegistration {
    _id: string;
    storeName: string;
    slug: string;
    ownerName: string;
    email: string;
    phone: string;
    hashedPassword: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const RegistrationSchema = new Schema<IRegistration>(
    {
        storeName: {
            type: String,
            required: [true, 'Nama toko wajib diisi'],
            trim: true,
        },
        slug: {
            type: String,
            required: [true, 'Slug wajib diisi'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        ownerName: {
            type: String,
            required: [true, 'Nama owner wajib diisi'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email wajib diisi'],
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Nomor HP/WA wajib diisi'],
            trim: true,
        },
        hashedPassword: {
            type: String,
            required: true,
            select: false, // Don't return by default
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        rejectionReason: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

export default RegistrationSchema;
