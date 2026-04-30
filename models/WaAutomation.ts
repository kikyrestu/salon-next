import mongoose, { Schema, Document } from "mongoose";

export interface IWaAutomation extends Document {
  name: string;
  category: 'daily_report' | 'stock_alert' | 'membership_expiry' | 'package_expiry' | 'birthday';
  targetRole: 'owner' | 'admin' | 'customer';
  scheduleTime?: string; // HH:mm format, e.g., "21:00"
  daysBefore?: number; // E.g., 7 for "7 days before expiry"
  messageTemplate: string;
  isActive: boolean;
  lastRunDate?: Date; // To prevent double execution on the same day
  createdAt: Date;
  updatedAt: Date;
}

const waAutomationSchema = new Schema<IWaAutomation>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['daily_report', 'stock_alert', 'membership_expiry', 'package_expiry', 'birthday'],
      required: true,
    },
    targetRole: {
      type: String,
      enum: ['owner', 'admin', 'customer'],
      required: true,
    },
    scheduleTime: { type: String, trim: true },
    daysBefore: { type: Number, min: 0 },
    messageTemplate: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastRunDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.WaAutomation ||
  mongoose.model<IWaAutomation>("WaAutomation", waAutomationSchema);
