import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus Usage Logs — hanya butuh usageLogs.view (bukan staff.view)
// Hanya return field yang dibutuhkan Usage Logs: _id, name
// Staff bisa pilih staff yang pakai product tanpa akses ke data sensitif staff
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "usageLogs", "view");
        if (permissionError) return permissionError;

        const staffMembers = await Staff.find({ isActive: true })
            .select("_id name")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: staffMembers });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch staff list" },
            { status: 500 }
        );
    }
}
