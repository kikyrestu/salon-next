
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Deposit from "@/models/Deposit";
import Invoice from "@/models/Invoice";
import { initModels } from "@/lib/initModels";

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();
        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get("invoiceId");

        let query = {};
        if (invoiceId) query = { invoice: invoiceId };

        const deposits = await Deposit.find(query).populate('customer').sort({ createdAt: -1 });
        return NextResponse.json({ success: true, data: deposits });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch deposits" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectToDB();
        const body = await request.json();

        // 1. Create the deposit
        const deposit = await Deposit.create(body);

        // 2. Update the invoice paidAmount and status
        const invoice = await Invoice.findById(body.invoice);
        if (invoice) {
            const newPaidAmount = (invoice.amountPaid || 0) + body.amount;
            invoice.amountPaid = newPaidAmount;

            if (newPaidAmount >= invoice.totalAmount) {
                invoice.status = 'paid';
            } else if (newPaidAmount > 0) {
                invoice.status = 'partially_paid';
            }
            await invoice.save();
        }

        return NextResponse.json({ success: true, data: deposit });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
