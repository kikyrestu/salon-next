import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus POS — hanya butuh pos.view (bukan customers.view)
// Return semua field yang dibutuhkan POS: identitas, membership, loyalitas, wallet, dan packageSummary
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Customer, CustomerPackage } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "pos", "view");
        if (permissionError) return permissionError;

        const customers = await Customer.find({ isActive: true })
            .select("_id name phone membershipTier membershipExpiry loyaltyPoints walletBalance referredBy")
            .sort({ name: 1 })
            .lean();

        // Hitung packageSummary (activePackages) untuk indikator hijau di POS
        const customerIds = customers.map((c: any) => c._id);
        const activePackages = await CustomerPackage.find({
            customer: { $in: customerIds },
            status: "active",
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } },
            ],
        }).select("customer").lean();

        const activeCountMap = new Map<string, number>();
        for (const pkg of activePackages as any[]) {
            const key = String(pkg.customer);
            activeCountMap.set(key, (activeCountMap.get(key) || 0) + 1);
        }

        const customersWithSummary = customers.map((c: any) => ({
            ...c,
            packageSummary: {
                activePackages: activeCountMap.get(String(c._id)) || 0,
            },
        }));

        return NextResponse.json({ success: true, data: customersWithSummary });
    } catch (error) {
        console.error("CUSTOMERS_POS_LIST_ERROR:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch customers list" },
            { status: 500 }
        );
    }
}