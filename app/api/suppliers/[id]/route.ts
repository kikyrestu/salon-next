import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';


// GET /api/suppliers/[id] - Get single supplier
export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Supplier } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;

        const supplier = await Supplier.findById(id);

        if (!supplier) {
            return NextResponse.json(
                { success: false, error: 'Supplier not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: supplier });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/suppliers/[id] - Update supplier
export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Supplier } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;

        const body = await request.json();
        const supplier = await Supplier.findByIdAndUpdate(
            id,
            body,
            { new: true, runValidators: true }
        );

        if (!supplier) {
            return NextResponse.json(
                { success: false, error: 'Supplier not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: supplier });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
        );
    }
}

// DELETE /api/suppliers/[id] - Delete supplier
export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Supplier } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;

        const supplier = await Supplier.findByIdAndDelete(id);

        if (!supplier) {
            return NextResponse.json(
                { success: false, error: 'Supplier not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Supplier deleted successfully'
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
