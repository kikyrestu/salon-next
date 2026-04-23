import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import { initModels, PackageOrder, CustomerPackage } from '@/lib/initModels';
import Invoice from '@/models/Invoice';

interface PatchBody {
  paid?: boolean;
  paymentMethod?: string;
}

async function generateInvoiceNumber(): Promise<string> {
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  let nextNum = 1;

  if (lastInvoice && lastInvoice.invoiceNumber) {
    const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `INV-${new Date().getFullYear()}-${nextNum.toString().padStart(5, '0')}`;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permissionError = await checkPermission(request, 'invoices', 'edit');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();

    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const order = await PackageOrder.findById(id).populate('package');
    if (!order) {
      return NextResponse.json({ success: false, error: 'Package order not found' }, { status: 404 });
    }

    if (!body.paid) {
      order.status = 'pending';
      await order.save();
      return NextResponse.json({ success: true, data: order });
    }

    let customerPackageId = order.activatedCustomerPackage;

    if (!customerPackageId) {
      const customerPackage = await CustomerPackage.create({
        customer: order.customer,
        package: order.package,
        packageName: order.packageSnapshot?.name || 'Package',
        order: order._id,
        activatedAt: new Date(),
        status: 'active',
        serviceQuotas: (order.packageSnapshot?.items || []).map((item: { service: import('mongoose').Types.ObjectId; serviceName: string; quota: number }) => ({
          service: item.service,
          serviceName: item.serviceName,
          totalQuota: Number(item.quota || 0),
          usedQuota: 0,
          remainingQuota: Number(item.quota || 0),
        })),
      });
      customerPackageId = customerPackage._id;
    }

    order.status = 'paid';
    order.activatedCustomerPackage = customerPackageId;
    await order.save();

    // Generate Invoice for this package purchase so it appears in reports, receipts, and customer history
    let createdInvoice = null;
    try {
      const packageName = order.packageSnapshot?.name || 'Package';
      const packageCode = order.packageSnapshot?.code || '';
      const amount = Number(order.amount || 0);
      const paymentMethod = body.paymentMethod || 'Cash';

      // Get commission info from the package if available
      const pkg = order.package as any;
      const commissionType = pkg?.commissionType || 'fixed';
      const commissionValue = Number(pkg?.commissionValue || 0);
      let commissionAmount = 0;
      if (commissionType === 'percentage') {
        commissionAmount = Math.round(amount * commissionValue / 100);
      } else {
        commissionAmount = commissionValue;
      }

      const invoiceNumber = await generateInvoiceNumber();

      createdInvoice = await Invoice.create({
        invoiceNumber,
        customer: order.customer,
        items: [{
          item: typeof order.package === 'object' && order.package?._id ? order.package._id : order.package,
          itemModel: 'Service', // Use Service as fallback since Invoice only supports Service/Product
          name: `Paket: ${packageName}${packageCode ? ` (${packageCode})` : ''}`,
          price: amount,
          quantity: 1,
          discount: 0,
          total: amount,
        }],
        subtotal: amount,
        tax: 0,
        discount: 0,
        totalAmount: amount,
        amountPaid: amount,
        tips: 0,
        paymentMethod,
        paymentMethods: [{ method: paymentMethod, amount }],
        status: 'paid',
        commission: commissionAmount,
        sourceType: 'package_purchase',
        notes: `Pembelian Paket ${packageName} (Order: ${order.orderNumber})`,
        date: new Date(),
      });
    } catch (invoiceError) {
      console.error('[PackageOrder] Failed to create invoice for package purchase:', invoiceError);
      // Don't fail the entire operation if invoice creation fails
    }

    return NextResponse.json({ success: true, data: order, invoice: createdInvoice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update package order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
