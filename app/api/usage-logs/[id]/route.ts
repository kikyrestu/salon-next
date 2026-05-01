import { getTenantModels } from "@/lib/tenantDb";

import { NextResponse } from "next/server";




export async function DELETE(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { UsageLog, Product } = await getTenantModels(tenantSlug);

    try {
        
        
        const { id } = await props.params;

        const log = await UsageLog.findById(id);
        if (!log) {
            return NextResponse.json({ success: false, error: "Usage log not found" }, { status: 404 });
        }

        // Revert product stock
        const product = await Product.findById(log.product);
        if (product) {
            product.stock += log.quantity;
            await product.save();
        }

        await UsageLog.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Usage log deleted and stock reverted" });
    } catch (error: any) {
        console.error("API Error UsageLog DELETE:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
