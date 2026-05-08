import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from "@/lib/rbac";

/**
 * PATCH /api/customers/[id]/notes
 * Allows users with `customers.view` permission to update only the
 * preferenceNotes field. This is intentionally a lower permission bar
 * than the full customer edit (PUT /api/customers/[id]) because notes
 * are non-sensitive operational data (e.g. "prefers warm water").
 */
export async function PATCH(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer } = await getTenantModels(tenantSlug);

    try {
        // Only require "view" permission — any staff who can see a customer
        // should be able to jot down preference notes.
        const permissionError = await checkPermission(request, 'customers', 'view');
        if (permissionError) return permissionError;

        const { id } = await props.params;
        const body = await request.json();

        if (typeof body.preferenceNotes !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Field "preferenceNotes" (string) is required' },
                { status: 400 }
            );
        }

        const customer = await Customer.findByIdAndUpdate(
            id,
            { preferenceNotes: body.preferenceNotes.trim() },
            { new: true, runValidators: true }
        );

        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'Customer not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: customer });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
        );
    }
}
