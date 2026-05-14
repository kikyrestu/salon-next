import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus POS — hanya butuh pos.view (bukan services.view)
// Hanya return field yang dibutuhkan POS: _id, name, price, duration
// Kasir bisa pilih service untuk transaksi tanpa akses ke data sensitif service
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Service } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "pos", "view");
        if (permissionError) return permissionError;

        const services = await Service.find({ status: "active" })
            .select("_id name price memberPrice image duration commissionType commissionValue waFollowUp")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: services });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch services list" },
            { status: 500 }
        );
    }
}