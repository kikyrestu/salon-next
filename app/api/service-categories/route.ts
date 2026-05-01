import { getTenantModels } from "@/lib/tenantDb";

import { NextResponse } from "next/server";


export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServiceCategory } = await getTenantModels(tenantSlug);

    try {
        
        const categories = await ServiceCategory.find({ status: "active" }).sort({ name: 1 });
        return NextResponse.json({ success: true, data: categories });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 });
    }
}

export async function POST(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServiceCategory } = await getTenantModels(tenantSlug);

    try {
        
        const body = await request.json();
        const category = await ServiceCategory.create(body);
        return NextResponse.json({ success: true, data: category });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 });
    }
}
