import mongoose, { Schema, Document } from 'mongoose';

/**
 * Counter model — digunakan untuk generate nomor invoice yang atomic.
 * Key format: "INV-{year}" (e.g. "INV-2026")
 * Setiap findOneAndUpdate dengan $inc dijamin atomic oleh MongoDB.
 */
export interface ICounter extends Document {
    _id: string;
    seq: number;
}

const CounterSchema = new Schema<ICounter>(
    {
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 },
    },
    { timestamps: false, collection: 'counters' }
);

// Guard untuk Next.js hot reload
const Counter = (mongoose.models.Counter as mongoose.Model<ICounter>) ||
    mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;