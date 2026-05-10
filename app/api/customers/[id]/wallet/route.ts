import { NextRequest, NextResponse } from "next/server";
import { getTenantModels } from "@/lib/tenantDb";
import { checkPermission } from "@/lib/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionError = await checkPermission(request, "customers", "view");
    if (permissionError) return permissionError;

    const { id } = await params;
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { WalletTransaction } = await getTenantModels(tenantSlug);

    const transactions = await WalletTransaction.find({ customer: id })
      .populate("invoice", "invoiceNumber")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil riwayat wallet" },
      { status: 500 }
    );
  }
}
