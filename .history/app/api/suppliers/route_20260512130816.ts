import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';


import { checkPermission, getViewScope } from '@/lib/rbac';
import { auth } from '@/auth';

// GET /api/suppliers - List all suppliers
export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Supplier } = await getTenantModels(tenantSlug);

    try {
        

        // Check Permissions
        const permissionError = await checkPermission(request, 'suppliers', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        // Build query
        const query: any = {};

        // Apply Scope
        const scope = await getViewScope('suppliers');
        if (scope === 'own') {
            const session: any = await auth();
            if (session?.user?.id) {
                query.createdBy = session.user.id;
            }
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }
        if (status) {
            query.status = status;
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const [suppliers, total] = await Promise.all([
            Supplier.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Supplier.countDocuments(query),
        ]);

        return NextResponse.json({
            success: true,
            data: suppliers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST /api/suppliers - Create new supplier
export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Supplier } = await getTenantModels(tenantSlug);

    try {
        

        // Check Permissions
        const permissionError = await checkPermission(request, 'suppliers', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();
        const session: any = await auth();
        const supplier = await Supplier.create({
            ...body,
            createdBy: session?.user?.id
        });

        return NextResponse.json(
            { success: true, data: supplier },
            { status: 201 }
        );
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
        );
    }
}
