
import mongoose, { Schema, Document } from 'mongoose';

export interface IStaff extends Document {
    name: string;
    email?: string;
    phone?: string;
    userId?: mongoose.Types.ObjectId; // Link to User for login
    designation?: string;
    skills: string[]; // e.g., ["Hair Cut", "Facial"]
    commissionRate: number; // Reserved staff commission setting (not used in POS split source)
    salary: number;
    joinDate?: Date;
    isActive: boolean;
    workingDays: {
        day: string; // Monday, Tuesday, etc.
        startTime: string; // "09:00"
        endTime: string; // "18:00"
        isOff: boolean;
    }[];
}

const staffSchema = new Schema<IStaff>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        designation: { type: String, trim: true },
        skills: [{ type: String }],
        commissionRate: { type: Number, default: 0 },
        salary: { type: Number, default: 0 },
        joinDate: { type: Date },
        isActive: { type: Boolean, default: true },
        workingDays: [
            {
                day: { type: String, required: true },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '18:00' },
                isOff: { type: Boolean, default: false },
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.models.Staff || mongoose.model<IStaff>('Staff', staffSchema);
