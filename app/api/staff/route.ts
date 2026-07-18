import { getTenantModels } from "@/lib/tenantDb";

import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { checkStaffLimit, getStoreIdBySlug } from "@/lib/subscriptionEnforcement";



export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Staff } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'staff', 'view');
        if (permissionError) return permissionError;
        
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = parseInt(searchParams.get("limit") || "10");
        const limit = limitParam === 0 ? 0 : limitParam;
        const skip = limit > 0 ? (page - 1) * limit : 0;

        const query: any = { isActive: true };
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const [staffMembers, total] = await Promise.all([
            limit > 0 ? Staff.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit) : Staff.find(query).sort({ createdAt: -1 }),
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

        // SaaS plan enforcement (blueprint section 4 - "titik create staff").
        const storeId = await getStoreIdBySlug(tenantSlug);
        if (storeId) {
            const staffCheck = await checkStaffLimit(tenantSlug, storeId);
            if (!staffCheck.allowed) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            staffCheck.reason === 'no_active_subscription'
                                ? 'Toko belum punya langganan aktif.'
                                : `Batas jumlah staff (${staffCheck.limit}) sudah tercapai. Upgrade paket atau beli add-on untuk menambah staff.`,
                        code: staffCheck.reason === 'no_active_subscription' ? 'NO_ACTIVE_SUBSCRIPTION' : 'STAFF_LIMIT_EXCEEDED',
                        currentUsage: staffCheck.currentUsage,
                        limit: staffCheck.limit,
                    },
                    { status: 403 }
                );
            }
        }

        const body = await request.json();
        const staff = await Staff.create(body);
        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to create staff" }, { status: 500 });
    }
}
