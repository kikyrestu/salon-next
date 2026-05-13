import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Packages — hanya butuh packages.view (bukan customers.view)
// Hanya return field yang dibutuhkan Packages: _id, name, phone
// Staff bisa pilih customer untuk package tanpa akses ke data sensitif customer
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Customer } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "packages", "view");
        if (permissionError) return permissionError;

        const customers = await Customer.find({ isActive: true })
            .select("_id name phone")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: customers });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch customers list" },
            { status: 500 }
        );
    }
}
