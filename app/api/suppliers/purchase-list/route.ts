import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Purchases — hanya butuh purchases.view (bukan suppliers.view)
// Hanya return field yang dibutuhkan Purchases: _id, name, contact
// Staff purchasing bisa pilih supplier tanpa akses ke data sensitif supplier
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Supplier } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "purchases", "view");
        if (permissionError) return permissionError;

        const suppliers = await Supplier.find({ isActive: true })
            .select("_id name contact")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: suppliers });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch suppliers list" },
            { status: 500 }
        );
    }
}
