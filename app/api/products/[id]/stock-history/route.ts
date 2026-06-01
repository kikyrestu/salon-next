import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest, props: any) {
  const tenantSlug = request.headers.get("x-store-slug") || "pusat";
  const { StockLog } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, "products", "view");
    if (permissionError) return permissionError;

    const { id } = await props.params;

    const logs = await StockLog.find({ product: id, storeSlug: tenantSlug })
      .populate({ 
        path: "invoice", 
        select: "invoiceNumber customer", 
        populate: { path: "customer", select: "name" } 
      })
      .sort({ createdAt: -1 })
      .limit(50); // Get last 50 logs

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stock history" },
      { status: 500 }
    );
  }
}
