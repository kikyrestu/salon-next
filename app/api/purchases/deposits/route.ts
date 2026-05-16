import { getTenantModels } from "@/lib/tenantDb";

import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";




export async function POST(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { PurchaseDeposit, Purchase } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request as any, 'purchases', 'create');
        if (permissionError) return permissionError;
        
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

export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { PurchaseDeposit, Purchase } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request as any, 'purchases', 'view');
        if (permissionError) return permissionError;
        
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

