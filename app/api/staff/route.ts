import { getTenantModels } from "@/lib/tenantDb";

import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";



export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'staff', 'view');
        if (permissionError) return permissionError;
        
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const skip = (page - 1) * limit;

        const query: any = { isActive: true };
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const [staffMembers, total] = await Promise.all([
            Staff.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Staff.countDocuments(query)
        ]);

        return NextResponse.json({
            success: true,
            data: staffMembers,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch staff" }, { status: 500 });
    }
}

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'staff', 'create');
        if (permissionError) return permissionError;
        
        const body = await request.json();
        const staff = await Staff.create(body);
        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to create staff" }, { status: 500 });
    }
}
