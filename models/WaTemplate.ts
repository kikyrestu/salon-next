import mongoose, { Document, Schema } from 'mongoose';

export interface IWaTemplate extends Document {
    name: string;
    message: string;
    templateType: 'greeting' | 'follow_up';
    isGreetingEnabled: boolean;
    createdAt: Date;
}

const waTemplateSchema = new Schema<IWaTemplate>(
    {
        name: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        templateType: {
            type: String,
            enum: ['greeting', 'follow_up'],
            default: 'follow_up',
            required: true,
        },
        isGreetingEnabled: { type: Boolean, default: false },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

waTemplateSchema.index({ name: 1 });

export default mongoose.models.WaTemplate || mongoose.model<IWaTemplate>('WaTemplate', waTemplateSchema);
