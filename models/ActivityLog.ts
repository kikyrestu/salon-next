import mongoose, { Schema, Document, models } from 'mongoose';

export interface IActivityLog extends Document {
    user: mongoose.Types.ObjectId;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ip?: string;
    userAgent?: string;
    createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        action: {
            type: String,
            required: true, // e.g., 'create', 'update', 'delete', 'login'
        },
        resource: {
            type: String,
            required: true, // e.g., 'Appointment', 'Customer', 'Product'
        },
        resourceId: {
            type: String,
        },
        details: {
            type: String,
        },
        ip: {
            type: String,
        },
        userAgent: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

const ActivityLog = models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);

export default ActivityLog;
