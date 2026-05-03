import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";


export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Expense } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorPUT = await checkPermission(request, 'expenses', 'edit');
    if (permissionErrorPUT) return permissionErrorPUT;
        
        const { id } = await props.params;
        const body = await request.json();
        const expense = await Expense.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json({ success: true, data: expense });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update expense" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Expense } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorDELETE = await checkPermission(request, 'expenses', 'delete');
    if (permissionErrorDELETE) return permissionErrorDELETE;
        
        const { id } = await props.params;
        await Expense.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete expense" }, { status: 500 });
    }
}
