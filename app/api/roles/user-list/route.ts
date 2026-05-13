import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Users — hanya butuh users.view (bukan roles.view)
// Hanya return field yang dibutuhkan Users: _id, name
// Staff bisa pilih role untuk user management tanpa akses ke data sensitif role
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Role } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "users", "view");
        if (permissionError) return permissionError;

        const roles = await Role.find()
            .select("_id name")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: roles });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch roles list" },
            { status: 500 }
        );
    }
}
