import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';
import WaCampaignQueue from '@/models/WaCampaignQueue';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const permError = await checkPermission(request, 'customers', 'view');
    if (permError) return permError;

    try {
        await connectToDB();
        initModels();

        const { id } = await params;
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
