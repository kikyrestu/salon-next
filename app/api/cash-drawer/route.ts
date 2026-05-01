import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";



import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { CashBalance, CashSession } = await getTenantModels(tenantSlug);

    try {
        
        

        // Check permission if needed
        const permissionError = await checkPermission(request, 'reports', 'view'); // Assuming reports or pos permission is enough
        if (permissionError) return permissionError;

        // Ensure at least one balance document exists
        let balance = await CashBalance.findOne();
        if (!balance) {
            balance = await CashBalance.create({
                kasirBalance: 0,
                brankasBalance: 0,
                bankBalance: 0
            });
        }

        // Get current active session
        const activeSession = await CashSession.findOne({ status: 'open' }).populate('openedBy', 'name email');

        return NextResponse.json({
            success: true,
            data: {
                balance,
                activeSession
            }
        });
    } catch (error: any) {
        console.error("Cash Drawer GET Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch cash drawer status" },
            { status: 500 }
        );
    }
}
