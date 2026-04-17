import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import { initModels, PackageOrder, CustomerPackage } from '@/lib/initModels';

interface PatchBody {
  paid?: boolean;
  paymentMethod?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permissionError = await checkPermission(request, 'invoices', 'edit');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();

    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const order = await PackageOrder.findById(id);
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

    return NextResponse.json({ success: true, data: order });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update package order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
