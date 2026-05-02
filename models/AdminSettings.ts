import mongoose, { Schema } from 'mongoose';

export interface IAdminSettings {
    _id: string;
    fonnteToken: string;
    adminPhone: string;
    adminName: string;
    createdAt: Date;
    updatedAt: Date;
}

export const AdminSettingsSchema = new Schema<IAdminSettings>(
    {
        fonnteToken: {
            type: String,
            default: '',
            trim: true,
        },
        adminPhone: {
            type: String,
            default: '',
            trim: true,
        },
        adminName: {
            type: String,
            default: 'Admin',
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

export default AdminSettingsSchema;
