import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";



import { checkPermission } from "@/lib/rbac";


export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer, Settings, Invoice } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, "membership", "create");
    if (permissionError) return permissionError;

    
    

    const body = await request.json();
    const { customerId, paymentMethod, staffId } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "Customer ID diperlukan" },
        { status: 400 }
      );
    }

    const settings = await Settings.findOne();
    if (!settings || !settings.membershipPrice || settings.membershipPrice <= 0) {
      return NextResponse.json(
        { success: false, error: "Harga membership belum diatur di Settings" },
        { status: 400 }
      );
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check if already premium and not expired
    if (
      customer.membershipTier === "premium" &&
      customer.membershipExpiry &&
      new Date(customer.membershipExpiry) > new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Customer sudah premium member sampai ${new Date(customer.membershipExpiry).toLocaleDateString("id-ID")}`,
        },
        { status: 400 }
      );
    }

    const durationDays = settings.membershipDurationDays || 365;
    const membershipExpiry = new Date();
    membershipExpiry.setDate(membershipExpiry.getDate() + durationDays);

    // Customer update moved to after Invoice creation

    // Generate Invoice Number (same logic as /api/invoices POST)
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const lastNum = parseInt(
        lastInvoice.invoiceNumber.split("-").pop() || "0"
      );
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum.toString().padStart(5, "0")}`;

    // Create invoice for membership purchase
    const invoice = await Invoice.create({
      invoiceNumber,
      customer: customerId,
      items: [
        {
          item: customerId, // reference to customer as the "item"
          itemModel: "Service", // use Service model reference for compatibility
          name: `Premium Membership (${durationDays} hari)`,
          price: settings.membershipPrice,
          quantity: 1,
          total: settings.membershipPrice,
        },
      ],
      subtotal: settings.membershipPrice,
      tax: 0,
      discount: 0,
      tips: 0,
      totalAmount: settings.membershipPrice,
      commission: 0,
      sourceType: "membership_purchase",
      paymentMethod: paymentMethod || "Cash",
      paymentMethods: [
        {
          method: paymentMethod || "Cash",
          amount: settings.membershipPrice,
        },
      ],
      status: "paid",
      amountPaid: settings.membershipPrice,
      staffAssignments: staffId
        ? [{ staff: staffId, staffId, percentage: 100, porsiPersen: 100, commission: 0, komisiNominal: 0, tip: 0 }]
        : [],
      staff: staffId || undefined,
      notes: `Pembelian Premium Membership - berlaku sampai ${membershipExpiry.toLocaleDateString("id-ID")}`,
    });

    // Update customer to premium AFTER invoice is successfully created
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: customerId },
      {
        $set: {
          membershipTier: "premium",
          membershipJoinDate: new Date(),
          membershipExpiry: membershipExpiry,
        }
      },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      data: {
        invoiceId: invoice._id,
        invoiceNumber,
        customer: {
          _id: updatedCustomer?._id || customer._id,
          name: updatedCustomer?.name || customer.name,
          membershipTier: updatedCustomer?.membershipTier || customer.membershipTier,
          membershipExpiry: updatedCustomer?.membershipExpiry || customer.membershipExpiry,
        },
      },
    });
  } catch (error: any) {
    console.error("Membership purchase error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pembelian membership" },
      { status: 500 }
    );
  }
}
