import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { checkPermission } from '@/lib/rbac';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { CustomerPackage, PackageUsageLedger } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, 'customers', 'view');
    if (permissionError) return permissionError;

    
    

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const includeLedger = searchParams.get('includeLedger') === 'true';

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, error: 'Valid customerId is required' }, { status: 400 });
    }

    const packages = await CustomerPackage.find({ customer: customerId, status: { $in: ['active', 'depleted'] } })
      .populate('package', 'name code')
      .sort({ activatedAt: -1 });

    if (!includeLedger) {
      return NextResponse.json({ success: true, data: packages });
    }

    const packageIds = packages.map((item) => item._id);
    const ledger = await PackageUsageLedger.find({ customerPackage: { $in: packageIds } })
      .populate('service', 'name')
      .populate('invoice', 'invoiceNumber date')
      .sort({ usedAt: -1 })
      .limit(200);

    return NextResponse.json({ success: true, data: packages, ledger });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customer packages';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
