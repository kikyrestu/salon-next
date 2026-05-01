import { getTenantModels } from "@/lib/tenantDb";
/**
 * GET /api/export/[entity]
 * Export data from the database as an Excel file.
 */
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';
import {
    exportToExcel,
    ENTITY_COLUMNS,
    ENTITY_LABEL,
    EntityType,
    ExcelColumn,
} from '@/lib/excel';

/* ------------------------------------------------------------------ */
/*  Export columns for "export-only" entities                           */
/* ------------------------------------------------------------------ */

const INVOICE_EXPORT_COLUMNS: ExcelColumn[] = [
    { header: 'Invoice Number', key: 'invoiceNumber', type: 'string' },
    { header: 'Date', key: 'date', type: 'date' },
    { header: 'Customer', key: 'customerName', type: 'string' },
    { header: 'Items', key: 'itemsSummary', type: 'string' },
    { header: 'Subtotal', key: 'subtotal', type: 'number' },
    { header: 'Tax', key: 'tax', type: 'number' },
    { header: 'Discount', key: 'discount', type: 'number' },
    { header: 'Total', key: 'totalAmount', type: 'number' },
    { header: 'Amount Paid', key: 'amountPaid', type: 'number' },
    { header: 'Tips', key: 'tips', type: 'number' },
    { header: 'Payment Method', key: 'paymentMethod', type: 'string' },
    { header: 'Status', key: 'status', type: 'string' },
    { header: 'Commission', key: 'commission', type: 'number' },
    { header: 'Notes', key: 'notes', type: 'string' },
];

/* ------------------------------------------------------------------ */
/*  Permission map                                                     */
/* ------------------------------------------------------------------ */
const RESOURCE_MAP: Record<string, string> = {
    services: 'services',
    products: 'products',
    customers: 'customers',
    staff: 'staff',
    suppliers: 'suppliers',
    'service-categories': 'services',
    expenses: 'expenses',
    vouchers: 'vouchers',
    invoices: 'invoices',
};

type ExportEntity = EntityType | 'invoices';

/* ------------------------------------------------------------------ */
/*  Data fetchers (now accepts models as parameter)                    */
/* ------------------------------------------------------------------ */

async function fetchExportData(entity: ExportEntity, searchParams: URLSearchParams, models: any) {
    const { Service, Product, Customer, Staff, Supplier, ServiceCategory, Expense, Voucher, Invoice } = models;

    switch (entity) {
        case 'services': {
            const docs = await Service.find({ status: 'active' })
                .populate('category', 'name')
                .sort({ name: 1 })
                .lean();
            return docs.map((d: any) => ({
                ...d,
                categoryName: d.category?.name || '',
            }));
        }
        case 'products': {
            return Product.find({ status: 'active' }).sort({ name: 1 }).lean();
        }
        case 'customers': {
            return Customer.find().sort({ name: 1 }).lean();
        }
        case 'staff': {
            return Staff.find({ isActive: true }).sort({ name: 1 }).lean();
        }
        case 'suppliers': {
            return Supplier.find({ status: 'active' }).sort({ name: 1 }).lean();
        }
        case 'service-categories': {
            return ServiceCategory.find({ status: 'active' }).sort({ name: 1 }).lean();
        }
        case 'expenses': {
            const from = searchParams.get('from');
            const to = searchParams.get('to');
            const query: any = {};
            if (from || to) {
                query.date = {};
                if (from) query.date.$gte = new Date(from);
                if (to) query.date.$lte = new Date(to);
            }
            return Expense.find(query).sort({ date: -1 }).lean();
        }
        case 'vouchers': {
            return Voucher.find().sort({ createdAt: -1 }).lean();
        }
        case 'invoices': {
            const from = searchParams.get('from');
            const to = searchParams.get('to');
            const query: any = {};
            if (from || to) {
                query.date = {};
                if (from) query.date.$gte = new Date(from);
                if (to) query.date.$lte = new Date(to);
            }
            const docs = await Invoice.find(query)
                .populate('customer', 'name')
                .sort({ date: -1 })
                .lean();
            return docs.map((d: any) => ({
                ...d,
                customerName: d.customer?.name || 'Walk-in',
                itemsSummary: (d.items || []).map((it: any) => `${it.name} x${it.quantity}`).join('; '),
            }));
        }
        default:
            return [];
    }
}

/* ------------------------------------------------------------------ */
/*  GET handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const models = await getTenantModels(tenantSlug);

    const { entity: rawEntity } = await props.params;
    const entity = rawEntity as ExportEntity;

    const allEntities = [...Object.keys(ENTITY_COLUMNS), 'invoices'];
    if (!allEntities.includes(entity)) {
        return NextResponse.json(
            { success: false, error: `Unknown entity: "${rawEntity}". Valid: ${allEntities.join(', ')}` },
            { status: 400 }
        );
    }

    // Permission check
    const resource = RESOURCE_MAP[entity] || entity;
    const permError = await checkPermission(request, resource, 'view');
    if (permError) return permError;

    try {
        const { searchParams } = new URL(request.url);
        const data = await fetchExportData(entity, searchParams, models);

        const columns = entity === 'invoices'
            ? INVOICE_EXPORT_COLUMNS
            : ENTITY_COLUMNS[entity as EntityType];

        const label = entity === 'invoices' ? 'Invoices' : (ENTITY_LABEL[entity as EntityType] || entity);
        const buf = exportToExcel(data as any[], columns, label);

        const filename = `export_${entity}_${new Date().toISOString().split('T')[0]}.xlsx`;
        return new NextResponse(new Uint8Array(buf), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache',
            },
        });
    } catch (err: any) {
        console.error('Export error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
