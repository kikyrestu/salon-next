import mongoose, { Schema, Document } from 'mongoose';

export interface IPayroll extends Document {
    staff: mongoose.Types.ObjectId;
    month: number; // 1-12
    year: number;
    baseSalary: number;
    totalCommission: number;
    totalTips: number;
    bonuses: number;
    deductions: number;
    totalAmount: number;
    status: 'draft' | 'approved' | 'paid';
    paidDate?: Date;
    paymentMethod?: string;
    notes?: string;
    breakdown: {
        appointments: {
            appointmentId: mongoose.Types.ObjectId;
            date: Date;
            services: {
                serviceName: string;
                serviceAmount: number;
                commissionRate: number;
                commissionAmount: number;
            }[];
            totalCommission: number;
            tips: number;
        }[];
        invoices: {
            invoiceId: mongoose.Types.ObjectId;
            invoiceNumber: string;
            date: Date;
            totalAmount: number;
            commission: number;
            tip: number;
        }[];
    };
    createdAt: Date;
    updatedAt: Date;
}

const PayrollSchema = new Schema<IPayroll>(
    {
        staff: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
            required: true,
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
        baseSalary: {
            type: Number,
            required: true,
            default: 0,
        },
        totalCommission: {
            type: Number,
            default: 0,
        },
        totalTips: {
            type: Number,
            default: 0,
        },
        bonuses: {
            type: Number,
            default: 0,
        },
        deductions: {
            type: Number,
            default: 0,
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['draft', 'approved', 'paid'],
            default: 'draft',
        },
        paidDate: Date,
        paymentMethod: String,
        notes: String,
        breakdown: {
            appointments: [{
                appointmentId: {
                    type: Schema.Types.ObjectId,
                    ref: 'Appointment',
                },
                date: Date,
                services: [{
                    serviceName: String,
                    serviceAmount: Number,
                    commissionRate: Number,
                    commissionAmount: Number,
                }],
                totalCommission: Number,
                tips: Number,
            }],
            invoices: [{
                invoiceId: {
                    type: Schema.Types.ObjectId,
                    ref: 'Invoice',
                },
                invoiceNumber: String,
                date: Date,
                totalAmount: Number,
                commission: Number,
                tip: Number,
            }],
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for unique payroll per staff per month
PayrollSchema.index({ staff: 1, month: 1, year: 1 }, { unique: true });

const Payroll = mongoose.models.Payroll || mongoose.model<IPayroll>('Payroll', PayrollSchema);

export default Payroll;
