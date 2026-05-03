import { getTenantModels } from "@/lib/tenantDb";

import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";


export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'staff', 'edit');
        if (permissionError) return permissionError;
        
        const { id } = await props.params;
        const body = await request.json();
        const staff = await Staff.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update staff" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'staff', 'edit');
        if (permissionError) return permissionError;
        
        const { id } = await props.params;
        await Staff.findByIdAndUpdate(id, { isActive: false }); // Soft delete
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete staff" }, { status: 500 });
    }
}
