import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffSlot extends Document {
    staff: mongoose.Types.ObjectId;
    type: 'date' | 'day';
    date?: Date;
    dayOfWeek?: string; // "Monday", "Tuesday", etc.
    startTime: string; // "09:00"
    endTime: string; // "10:00"
    isAvailable: boolean;
    slotDuration: number; // Duration in minutes (default 30)
    notes?: string;
}

const staffSlotSchema = new Schema<IStaffSlot>(
    {
        staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
        type: { type: String, enum: ['date', 'day'], default: 'date', required: true },
        date: { type: Date, required: false },
        dayOfWeek: { type: String, required: false },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        isAvailable: { type: Boolean, default: true },
        slotDuration: { type: Number, default: 30 }, // Default 30 minutes per slot
        notes: { type: String, trim: true },
    },
    { timestamps: true }
);

// Index for efficient queries
staffSlotSchema.index({ staff: 1, type: 1, date: 1, startTime: 1 });
staffSlotSchema.index({ staff: 1, type: 1, dayOfWeek: 1, startTime: 1 });
staffSlotSchema.index({ staff: 1, date: 1 });

// Force delete model to handle schema changes in development
if (mongoose.models.StaffSlot) {
    delete (mongoose.models as any).StaffSlot;
}

const StaffSlot = mongoose.model<IStaffSlot>('StaffSlot', staffSlotSchema);

export default StaffSlot;

