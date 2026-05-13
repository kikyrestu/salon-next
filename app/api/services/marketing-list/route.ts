import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus WA Marketing — hanya butuh customers.view (bukan services.view)
// Hanya return field yang dibutuhkan WA Marketing: _id, name
// Staff bisa pilih service untuk marketing campaign tanpa akses ke data sensitif service
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Service } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "customers", "view");
        if (permissionError) return permissionError;

        const services = await Service.find({ isActive: true })
            .select("_id name")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: services });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch services list" },
            { status: 500 }
        );
    }
}
