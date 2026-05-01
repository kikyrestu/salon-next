import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { checkPermission } from '@/lib/rbac';


interface CustomerInfo {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface InvoiceHistoryItem {
  _id: string;
  invoiceNumber: string;
  date?: Date;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentMethod: string;
  sourceType: string;
  createdAt: Date;
}

interface PackageOrderHistoryItem {
  _id: string;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  paidAt?: Date;
  createdAt: Date;
  packageSnapshot?: {
    name?: string;
    code?: string;
  };
}

interface PackageUsageHistoryItem {
  _id: string;
  serviceName: string;
  quantity: number;
  usedAt: Date;
  sourceType: string;
  note?: string;
  createdAt: Date;
  invoice?: {
    _id?: string;
    invoiceNumber?: string;
    date?: Date;
  };
}

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, PackageOrder, PackageUsageLedger, Customer } = await getTenantModels(tenantSlug);

  try {
    
    

    const permissionError = await checkPermission(request, 'customers', 'view');
    if (permissionError) return permissionError;

    const { id } = await props.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid customer id' }, { status: 400 });
    }

    const customer = await Customer.findById(id).select('name phone email').lean<CustomerInfo>();
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const [invoices, packageOrders, packageUsage] = await Promise.all([
      Invoice.find({ customer: id })
        .select('invoiceNumber date totalAmount amountPaid status paymentMethod sourceType createdAt items')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean<InvoiceHistoryItem[]>(),
      PackageOrder.find({ customer: id })
        .select('totalAmount status paymentMethod paidAt createdAt packageSnapshot.name packageSnapshot.code')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean<PackageOrderHistoryItem[]>(),
      PackageUsageLedger.find({ customer: id })
        .populate('invoice', 'invoiceNumber date')
        .select('serviceName quantity usedAt sourceType note invoice createdAt')
        .sort({ usedAt: -1 })
        .limit(50)
        .lean<PackageUsageHistoryItem[]>(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        customer,
        invoices,
        packageOrders,
        packageUsage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customer history';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
