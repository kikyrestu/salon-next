import { getTenantModels } from "@/lib/tenantDb";
import { NextResponse } from "next/server";


export async function PUT(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServiceCategory } = await getTenantModels(tenantSlug);

    try {
        
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

export async function DELETE(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServiceCategory } = await getTenantModels(tenantSlug);

    try {
        
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
