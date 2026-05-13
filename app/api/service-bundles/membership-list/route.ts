import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Membership — hanya butuh membership.view (bukan bundles.view)
// Hanya return field yang dibutuhkan Membership: _id, name, price
// Staff bisa pilih bundle untuk membership tanpa akses ke data sensitif bundle
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { ServiceBundle } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "membership", "view");
        if (permissionError) return permissionError;

        const bundles = await ServiceBundle.find({ isActive: true })
            .select("_id name price")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: bundles });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch bundles list" },
            { status: 500 }
        );
    }
}
