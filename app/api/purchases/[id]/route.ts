import { getTenantModels } from "@/lib/tenantDb";

import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";





export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Purchase, Product, Supplier } = await getTenantModels(tenantSlug);

    try {
        const { id } = await props.params;
        
        

        const purchase = await Purchase.findById(id)
            .populate('supplier')
            .populate('items.product')
            .populate('createdBy', 'name');

        if (!purchase) {
            return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: purchase });
    } catch (error) {
        console.error("API Error Purchases Single GET:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch purchase" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Purchase, Product, Supplier } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorDELETE = await checkPermission(request, 'purchases', 'delete');
    if (permissionErrorDELETE) return permissionErrorDELETE;
        const { id } = await props.params;
        
        

        const purchase = await Purchase.findById(id);

        if (!purchase) {
            return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
        }

        // If status was received, we need to revert the stock increase
        if (purchase.status === 'received') {
            for (const item of purchase.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock -= item.quantity;
                    // Note: We don't check for negative stock here because a purchase might be deleted
                    // for correction, and the user might be aware of the stock status.
                    await product.save();
                }
            }
        }

        await Purchase.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Purchase deleted successfully" });
    } catch (error) {
        console.error("API Error Purchases Single DELETE:", error);
        return NextResponse.json({ success: false, error: "Failed to delete purchase" }, { status: 500 });
    }
}
