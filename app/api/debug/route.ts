import { NextResponse } from "next/server";
import { getTenantModels } from "@/lib/tenantDb";

export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    try {
        const models = await getTenantModels(tenantSlug);
        // Try to perform a simple operation on a new model
        // @ts-ignore
        const purchaseCount = await models.Purchase.countDocuments();

        return NextResponse.json({
            success: true,
            message: "Database and Models loaded successfully",
            models: Object.keys(models),
            purchaseCount
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
