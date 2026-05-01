import { getTenantModels } from "@/lib/tenantDb";

import { NextResponse } from "next/server";


export async function PUT(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;
        const body = await request.json();
        const staff = await Staff.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update staff" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;
        await Staff.findByIdAndUpdate(id, { isActive: false }); // Soft delete
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete staff" }, { status: 500 });
    }
}
