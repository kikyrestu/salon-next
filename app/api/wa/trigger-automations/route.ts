import { NextRequest, NextResponse } from 'next/server';
import { processPendingCampaigns, processAutomations } from '@/lib/scheduler';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';

// This internal endpoint allows the authenticated dashboard to securely trigger
// the scheduler without exposing the CRON_SECRET to the client bundle.
export async function GET(request: NextRequest, props: any) {
    try {
        // Enforce that only logged-in dashboard users can trigger this
        const permError = await checkPermission(request, 'settings', 'view');
        if (permError) return permError;

        const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
        await connectToDB();
        
        // WAJIB await dan teruskan slug spesifik
        await processPendingCampaigns();
        await processAutomations(new Date(), tenantSlug);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
