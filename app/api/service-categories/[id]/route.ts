import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";


export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServiceCategory } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorPUT = await checkPermission(request, 'services', 'edit');
    if (permissionErrorPUT) return permissionErrorPUT;
        
        const { id } = await props.params;
        const body = await request.json();
        const category = await ServiceCategory.findByIdAndUpdate(id, body, { new: true });

        if (!category) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: category });
    } catch (error) {
        console.error("Error updating category:", error);
        return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServiceCategory } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorDELETE = await checkPermission(request, 'services', 'delete');
    if (permissionErrorDELETE) return permissionErrorDELETE;
        
        const { id } = await props.params;
        const category = await ServiceCategory.findByIdAndUpdate(id, { status: "inactive" }, { new: true });

        if (!category) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: category });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 });
    }
}
