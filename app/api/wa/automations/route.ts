import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';
import WaAutomation from '@/models/WaAutomation';

export async function GET(request: NextRequest) {
    const permError = await checkPermission(request, 'settings', 'view');
    if (permError) return permError;

    try {
        await connectToDB();
        initModels();

        const automations = await WaAutomation.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: automations });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const permError = await checkPermission(request, 'settings', 'edit');
    if (permError) return permError;

    try {
        await connectToDB();
        initModels();

        const body = await request.json();
        
        if (!body.name || !body.category || !body.targetRole || !body.messageTemplate) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const automation = await WaAutomation.create(body);

        return NextResponse.json({ success: true, data: automation });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
