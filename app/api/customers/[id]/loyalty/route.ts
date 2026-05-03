import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest, props: any) {
  const tenantSlug = request.headers.get("x-store-slug") || "pusat";
  const { LoyaltyTransaction, Customer } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, "customers", "view");
    if (permissionError) return permissionError;

    const { id } = await props.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    const transactions = await LoyaltyTransaction.find({ customer: id })
      .sort({ date: -1 })
      .populate("invoice", "invoiceNumber")
      .limit(50); // Get last 50 transactions

    return NextResponse.json({ success: true, data: transactions });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch loyalty history";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
