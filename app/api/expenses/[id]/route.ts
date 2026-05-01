import { getTenantModels } from "@/lib/tenantDb";
import { NextResponse } from "next/server";


export async function PUT(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Expense } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;
        const body = await request.json();
        const expense = await Expense.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json({ success: true, data: expense });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update expense" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Expense } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;
        await Expense.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete expense" }, { status: 500 });
    }
}
