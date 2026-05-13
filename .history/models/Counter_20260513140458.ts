import mongoose, { Schema } from 'mongoose';

/**
 * Counter model — digunakan untuk generate nomor invoice yang atomic.
 * Key format: "INV-{year}" (e.g. "INV-2026")
 */
const CounterSchema = new Schema(
    {
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 },
    },
    { timestamps: false, collection: 'counters' }
);

const Counter = (mongoose.models.Counter as mongoose.Model<typeof CounterSchema>) ||
    mongoose.model('Counter', CounterSchema);

export default Counter;