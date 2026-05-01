import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaCampaignQueue } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'customers', 'view');
    if (permError) return permError;

    try {
        
        

        const { id } = await props.params;
        const campaign = await WaCampaignQueue.findById(id)
            .populate('targets.customerId', 'name phone')
            .populate('sentBy', 'name')
            .lean();

        if (!campaign) {
            return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: campaign });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
