import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";


import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { CashLog } = await getTenantModels(tenantSlug);

    try {
        
        

        const permissionError = await checkPermission(request, 'reports', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        const query: any = {};
        
        const type = searchParams.get("type");
        if (type) query.type = type;

        const total = await CashLog.countDocuments(query);
        const logs = await CashLog.find(query)
            .populate('performedBy', 'name')
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return NextResponse.json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error("Cash Drawer Logs API Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch cash logs" },
            { status: 500 }
        );
    }
}
