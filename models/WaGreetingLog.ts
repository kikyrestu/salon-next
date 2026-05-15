import mongoose, { Document, Schema } from 'mongoose';

export interface IWaGreetingLog extends Document {
    phoneRaw: string;
    phoneNormalized: string;
    firstMessageAt: Date;
    greetingSentAt?: Date;
}

const waGreetingLogSchema = new Schema<IWaGreetingLog>(
    {
        phoneRaw: { type: String, required: true, trim: true },
        phoneNormalized: { type: String, required: true, trim: true, unique: true },
        firstMessageAt: { type: Date, required: true, default: Date.now },
        greetingSentAt: { type: Date },
    },
    { timestamps: true }
);

// BUG-03 FIX: TTL index — auto-delete log setelah 30 hari
// Agar customer yang kembali setelah lama bisa mendapat greeting ulang
waGreetingLogSchema.index({ firstMessageAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export default mongoose.models.WaGreetingLog || mongoose.model<IWaGreetingLog>('WaGreetingLog', waGreetingLogSchema);

