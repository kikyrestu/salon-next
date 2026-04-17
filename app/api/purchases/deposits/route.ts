
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import PurchaseDeposit from "@/models/PurchaseDeposit";
import Purchase from "@/models/Purchase";

export async function POST(request: Request) {
    try {
        await connectToDB();
        initModels();
        const body = await request.json();
        const { purchase: purchaseId, amount, paymentMethod, notes, supplier } = body;

        // 1. Create the purchase deposit
        const deposit = await PurchaseDeposit.create({
            purchase: purchaseId,
            supplier,
            amount,
            paymentMethod,
            notes
        });

        // 2. Update the purchase paidAmount and status
        const purchase = await Purchase.findById(purchaseId);
        if (purchase) {
            const newPaidAmount = (purchase.paidAmount || 0) + Number(amount);
            purchase.paidAmount = newPaidAmount;

            if (newPaidAmount >= purchase.totalAmount) {
                purchase.paymentStatus = 'paid';
            } else if (newPaidAmount > 0) {
                purchase.paymentStatus = 'partially_paid';
            }
            await purchase.save();
        }

        return NextResponse.json({ success: true, data: deposit });
    } catch (error: any) {
        console.error("API Error Purchase Deposits POST:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();
        const { searchParams } = new URL(request.url);
        const purchaseId = searchParams.get("purchaseId");

        let query = {};
        if (purchaseId) query = { purchase: purchaseId };

        const deposits = await PurchaseDeposit.find(query).populate('supplier').sort({ createdAt: -1 });
        return NextResponse.json({ success: true, data: deposits });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch purchase deposits" }, { status: 500 });
    }
}
