import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';


export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaAutomation } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'settings', 'edit');
    if (permError) return permError;

    try {
        const { id } = await props.params;
        
        

        const body = await request.json();
        
        const automation = await WaAutomation.findByIdAndUpdate(id, body, { new: true });
        if (!automation) {
            return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: automation });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaAutomation } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'settings', 'edit');
    if (permError) return permError;

    try {
        const { id } = await props.params;
        
        

        const automation = await WaAutomation.findByIdAndDelete(id);
        if (!automation) {
            return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Automation deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
