import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Purchases — hanya butuh purchases.view (bukan products.view)
// Hanya return field yang dibutuhkan Purchases: _id, name, stock, unit
// Staff purchasing bisa pilih product untuk purchase order tanpa akses ke data sensitif product
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Product } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "purchases", "view");
        if (permissionError) return permissionError;

        const products = await Product.find({ status: 'active' })
            .select("_id name stock unit")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: products });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch products list" },
            { status: 500 }
        );
    }
}
