import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import { initModels, PackageOrder, ServicePackage, Customer } from '@/lib/initModels';

interface PackageOrderBody {
  customerId: string;
  packageId: string;
}

function makeOrderNumber(): string {
  return `PKG-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
}

export async function GET(request: NextRequest) {
  try {
    const permissionError = await checkPermission(request, 'invoices', 'view');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) query.customer = customerId;
    if (status) query.status = status;

    const orders = await PackageOrder.find(query)
      .populate('customer', 'name phone')
      .populate('package', 'name code price')
      .populate('activatedCustomerPackage')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: orders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch package orders';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionError = await checkPermission(request, 'invoices', 'create');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();

    const body = (await request.json()) as PackageOrderBody;
    const { customerId, packageId } = body;

    if (!customerId || !packageId) {
      return NextResponse.json({ success: false, error: 'customerId and packageId are required' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(packageId)) {
      return NextResponse.json({ success: false, error: 'Invalid customerId or packageId' }, { status: 400 });
    }

    const [customer, servicePackage] = await Promise.all([
      Customer.findById(customerId).select('_id name'),
      ServicePackage.findById(packageId),
    ]);

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    if (!servicePackage || !servicePackage.isActive) {
      return NextResponse.json({ success: false, error: 'Service package not found or inactive' }, { status: 404 });
    }

    if (!servicePackage.items || servicePackage.items.length === 0) {
      return NextResponse.json({ success: false, error: 'Service package has no service items' }, { status: 400 });
    }

    const order = await PackageOrder.create({
      orderNumber: makeOrderNumber(),
      customer: customer._id,
      package: servicePackage._id,
      packageSnapshot: {
        name: servicePackage.name,
        code: servicePackage.code,
        price: Number(servicePackage.price || 0),
        items: servicePackage.items.map((item: { service: mongoose.Types.ObjectId; serviceName: string; quota: number }) => ({
          service: item.service,
          serviceName: item.serviceName,
          quota: Number(item.quota || 0),
        })),
      },
      amount: Number(servicePackage.price || 0),
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      data: {
        order,
        payment: {
          sourceType: 'package_order',
          sourceId: order._id,
          amount: order.amount,
          customer: customer._id,
          description: `Pembelian Paket ${servicePackage.name} (${order.orderNumber})`,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create package order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
