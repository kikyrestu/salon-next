import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Membership — hanya butuh membership.view (bukan products.view)
// Hanya return field yang dibutuhkan Membership: _id, name, price, stock
// Staff bisa pilih product untuk membership tanpa akses ke data sensitif product
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Product } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "membership", "view");
        if (permissionError) return permissionError;

        const products = await Product.find({ isActive: true })
            .select("_id name price stock")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: products });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch products list" },
            { status: 500 }
        );
    }
}
