
import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
    title: string;
    amount: number;
    category: string;
    date: Date;
    reference?: string;
    notes?: string;
    paymentMethod: string;
    recordedBy: mongoose.Types.ObjectId;
}

const expenseSchema = new Schema<IExpense>(
    {
        title: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
        category: { type: String, required: true, trim: true },
        date: { type: Date, default: Date.now },
        reference: { type: String, trim: true },
        notes: { type: String, trim: true },
        paymentMethod: { type: String, default: 'Cash' },
        recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// Optimize query performance
expenseSchema.index({ date: 1 });

export default mongoose.models.Expense || mongoose.model<IExpense>('Expense', expenseSchema);
