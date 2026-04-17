import mongoose, { Document, Schema } from 'mongoose';

export interface IWaGreetingLog extends Document {
    phoneRaw: string;
    phoneNormalized: string;
    firstMessageAt: Date;
    greetingSentAt: Date;
}

const waGreetingLogSchema = new Schema<IWaGreetingLog>(
    {
        phoneRaw: { type: String, required: true, trim: true },
        phoneNormalized: { type: String, required: true, trim: true, unique: true },
        firstMessageAt: { type: Date, required: true, default: Date.now },
        greetingSentAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true }
);

waGreetingLogSchema.index({ phoneNormalized: 1 }, { unique: true });

export default mongoose.models.WaGreetingLog || mongoose.model<IWaGreetingLog>('WaGreetingLog', waGreetingLogSchema);
