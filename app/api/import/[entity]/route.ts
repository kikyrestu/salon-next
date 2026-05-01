import { getTenantModels } from "@/lib/tenantDb";
/**
 * POST /api/import/[entity]
 * Upload an Excel file and bulk-insert rows into the database.
 * Returns { success: true, imported: N, failed: N, errors: [...] }
 */
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';
import { logActivity } from '@/lib/logger';
import { normalizeIndonesianPhone } from '@/lib/phone';
import { parseExcelBuffer, ENTITY_COLUMNS, EntityType, ParsedRow } from '@/lib/excel';
import crypto from 'crypto';

import { auth } from '@/auth';

/* ------------------------------------------------------------------ */
/*  Permission map — which RBAC resource to check for each entity      */
/* ------------------------------------------------------------------ */
const RESOURCE_MAP: Record<EntityType, string> = {
    services: 'services',
    products: 'products',
    customers: 'customers',
    staff: 'staff',
    suppliers: 'suppliers',
    'service-categories': 'services',   // categories fall under services
    expenses: 'expenses',
    vouchers: 'vouchers',
};

/* ------------------------------------------------------------------ */
/*  Helpers (now accept models as parameter)                           */
/* ------------------------------------------------------------------ */

/** Resolve or auto-create a ServiceCategory by name, returning its _id */
async function resolveServiceCategory(name: string, models: any): Promise<string> {
    const { ServiceCategory } = models;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    let cat = await ServiceCategory.findOne({
        $or: [
            { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { slug },
        ],
    });
    if (!cat) {
        cat = await ServiceCategory.create({ name, slug, status: 'active' });
    }
    return String(cat._id);
}

/** Generate a unique referral code for a customer */
async function generateReferralCode(models: any): Promise<string> {
    const { Customer } = models;
    let code = '';
    let attempts = 0;
    while (!code && attempts < 15) {
        attempts++;
        const candidate = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
        const exists = await Customer.findOne({ referralCode: candidate }).lean();
        if (!exists) code = candidate;
    }
    return code;
}

/* ------------------------------------------------------------------ */
/*  Entity-specific inserters (now accept models as parameter)         */
/* ------------------------------------------------------------------ */

type InsertResult = { inserted: number; rowErrors: { row: number; errors: string[] }[] };

async function insertServices(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { Service } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            const categoryId = await resolveServiceCategory(d.categoryName, models);
            await Service.create({
                name: d.name,
                category: categoryId,
                description: d.description || '',
                duration: d.duration,
                price: d.price,
                memberPrice: d.memberPrice || undefined,
                gender: d.gender || 'unisex',
                commissionType: d.commissionType || 'fixed',
                commissionValue: d.commissionValue || 0,
                status: 'active',
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertProducts(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { Product } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            await Product.create({
                name: d.name,
                category: d.category,
                brand: d.brand || '',
                description: d.description || '',
                price: d.price,
                memberPrice: d.memberPrice || undefined,
                costPrice: d.costPrice,
                stock: d.stock ?? 0,
                alertQuantity: d.alertQuantity ?? 5,
                sku: d.sku || undefined,
                barcode: d.barcode || undefined,
                type: d.type || 'retail',
                commissionType: d.commissionType || 'fixed',
                commissionValue: d.commissionValue || 0,
                status: 'active',
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertCustomers(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { Customer } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            const referralCode = await generateReferralCode(models);
            const phone = d.phone ? normalizeIndonesianPhone(d.phone) : undefined;
            await Customer.create({
                name: d.name,
                email: d.email || undefined,
                phone,
                address: d.address || undefined,
                notes: d.notes || undefined,
                membershipTier: d.membershipTier || 'regular',
                birthday: d.birthday || undefined,
                waNotifEnabled: d.waNotifEnabled !== false,
                referralCode,
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertStaff(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { Staff } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            const skills = typeof d.skills === 'string'
                ? d.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
                : [];
            await Staff.create({
                name: d.name,
                email: d.email || undefined,
                phone: d.phone || undefined,
                designation: d.designation || undefined,
                skills,
                commissionRate: d.commissionRate || 0,
                salary: d.salary || 0,
                joinDate: d.joinDate || undefined,
                isActive: true,
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertSuppliers(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { Supplier } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            await Supplier.create({
                name: d.name,
                contactPerson: d.contactPerson || undefined,
                email: d.email || undefined,
                phone: d.phone || undefined,
                address: d.address || undefined,
                status: 'active',
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertServiceCategories(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { ServiceCategory } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            const slug = d.name.toLowerCase().replace(/\s+/g, '-');
            // Skip if already exists
            const exists = await ServiceCategory.findOne({
                $or: [{ name: d.name }, { slug }],
            });
            if (exists) {
                errors.push({ row: row.rowIndex, errors: [`Category "${d.name}" already exists`] });
                continue;
            }
            await ServiceCategory.create({
                name: d.name,
                description: d.description || '',
                slug,
                status: 'active',
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertExpenses(rows: ParsedRow[], userId: string, models: any): Promise<InsertResult> {
    const { Expense } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            await Expense.create({
                title: d.title,
                amount: d.amount,
                category: d.category,
                date: d.date || new Date(),
                reference: d.reference || undefined,
                notes: d.notes || undefined,
                paymentMethod: d.paymentMethod || 'Cash',
                recordedBy: userId,
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

async function insertVouchers(rows: ParsedRow[], models: any): Promise<InsertResult> {
    const { Voucher } = models;
    const errors: InsertResult['rowErrors'] = [];
    let inserted = 0;

    for (const row of rows) {
        try {
            const d = row.data;
            await Voucher.create({
                code: String(d.code).toUpperCase(),
                description: d.description || '',
                discountType: d.discountType,
                discountValue: d.discountValue,
                minPurchase: d.minPurchase || 0,
                maxDiscount: d.maxDiscount || undefined,
                expiresAt: d.expiresAt || undefined,
                usageLimit: d.usageLimit ?? 1,
                isActive: true,
            });
            inserted++;
        } catch (err: any) {
            errors.push({ row: row.rowIndex, errors: [err.message] });
        }
    }
    return { inserted, rowErrors: errors };
}

/* ------------------------------------------------------------------ */
/*  Main POST handler                                                  */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const models = await getTenantModels(tenantSlug);

    const { entity: rawEntity } = await props.params;
    const entity = rawEntity as EntityType;

    if (!ENTITY_COLUMNS[entity]) {
        return NextResponse.json(
            { success: false, error: `Unknown entity: "${rawEntity}"` },
            { status: 400 }
        );
    }

    // Permission check
    const resource = RESOURCE_MAP[entity];
    const permError = await checkPermission(request, resource, 'create');
    if (permError) return permError;

    // Read file from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
        return NextResponse.json(
            { success: false, error: 'No file uploaded. Send a form field named "file".' },
            { status: 400 }
        );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseExcelBuffer(buffer, entity);

    if (parsed.totalRows === 0) {
        return NextResponse.json(
            { success: false, error: 'The uploaded file contains no data rows.' },
            { status: 400 }
        );
    }

    // Get user for recordedBy etc.
    const session: any = await auth();
    const userId = session?.user?.id || '';

    // Insert valid rows
    let result: InsertResult = { inserted: 0, rowErrors: [] };

    switch (entity) {
        case 'services':
            result = await insertServices(parsed.success, models);
            break;
        case 'products':
            result = await insertProducts(parsed.success, models);
            break;
        case 'customers':
            result = await insertCustomers(parsed.success, models);
            break;
        case 'staff':
            result = await insertStaff(parsed.success, models);
            break;
        case 'suppliers':
            result = await insertSuppliers(parsed.success, models);
            break;
        case 'service-categories':
            result = await insertServiceCategories(parsed.success, models);
            break;
        case 'expenses':
            result = await insertExpenses(parsed.success, userId, models);
            break;
        case 'vouchers':
            result = await insertVouchers(parsed.success, models);
            break;
    }

    // Merge parse errors + insert errors
    const allErrors = [
        ...parsed.errors.map(e => ({ row: e.rowIndex, errors: e.errors })),
        ...result.rowErrors,
    ].sort((a, b) => a.row - b.row);

    // Log activity
    await logActivity({
        req: request,
        action: 'import',
        resource: entity,
        details: `Imported ${result.inserted} ${entity} from Excel. ${allErrors.length} rows failed.`,
    });

    return NextResponse.json({
        success: true,
        imported: result.inserted,
        failed: allErrors.length,
        totalRows: parsed.totalRows,
        errors: allErrors.slice(0, 50), // Cap error list
    });
}
