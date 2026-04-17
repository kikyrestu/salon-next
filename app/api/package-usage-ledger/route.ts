import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import { initModels, PackageUsageLedger } from '@/lib/initModels';

export async function GET(request: NextRequest) {
  try {
    const permissionError = await checkPermission(request, 'customers', 'view');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const customerPackageId = searchParams.get('customerPackageId');

    const query: Record<string, unknown> = {};
    if (customerId) {
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return NextResponse.json({ success: false, error: 'Invalid customerId' }, { status: 400 });
      }
      query.customer = customerId;
    }

    if (customerPackageId) {
      if (!mongoose.Types.ObjectId.isValid(customerPackageId)) {
        return NextResponse.json({ success: false, error: 'Invalid customerPackageId' }, { status: 400 });
      }
      query.customerPackage = customerPackageId;
    }

    const logs = await PackageUsageLedger.find(query)
      .populate('customer', 'name phone')
      .populate('service', 'name')
      .populate('invoice', 'invoiceNumber date totalAmount sourceType')
      .sort({ usedAt: -1 })
      .limit(500);

    return NextResponse.json({ success: true, data: logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch package ledger';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
