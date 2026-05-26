import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getTenantModels } from "@/lib/tenantDb";

export async function GET(req: NextRequest) {
  try {
    await connectToDB();
    // Assuming single-tenant or default tenant for cron if not provided, but usually cron is called per tenant.
    // Let's use 'pusat' or derive from header if available
    const tenantSlug = req.headers.get("x-store-slug") || "pusat";
    const { Settings, Customer, WalletTransaction } = await getTenantModels(tenantSlug);

    const settings = await Settings.findOne();
    const expiryDays = settings?.walletExpiryDays || 0;
    if (expiryDays <= 0) {
      return NextResponse.json({ success: true, message: "Wallet expiry disabled", expired: 0 });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - expiryDays);

    const customers = await Customer.find({ walletBalance: { $gt: 0 } });

    let expiredCount = 0;
    for (const customer of customers) {
      const lastTx = await WalletTransaction.findOne({ customer: customer._id })
        .sort({ createdAt: -1 })
        .lean();

      if (!lastTx || new Date(lastTx.createdAt) < cutoffDate) {
        const expiredAmount = customer.walletBalance;
        await Customer.findByIdAndUpdate(customer._id, { walletBalance: 0 });
        await WalletTransaction.create({
          customer: customer._id,
          type: "expired",
          amount: -expiredAmount,
          balanceAfter: 0,
          description: `Saldo hangus (tidak digunakan selama ${expiryDays} hari)`,
        });
        expiredCount++;
      }
    }

    return NextResponse.json({ success: true, message: `${expiredCount} wallet(s) expired`, expired: expiredCount });
  } catch (error: any) {
    console.error("Wallet expiry cron error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
