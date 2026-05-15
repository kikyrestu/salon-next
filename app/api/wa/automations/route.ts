import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';

import { checkPermission } from '@/lib/rbac';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaAutomation } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'settings', 'view');
    if (permError) return permError;

    try {
        
        

        const automations = await WaAutomation.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: automations });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaAutomation } = await getTenantModels(tenantSlug);

    const permError = await checkPermission(request, 'settings', 'edit');
    if (permError) return permError;

    try {
        
        

        const body = await request.json();
        
        if (!body.name || !body.category || !body.targetRole || !body.messageTemplate) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        if (body.scheduleTime) {
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.scheduleTime)) {
                return NextResponse.json({ success: false, error: 'Invalid scheduleTime format. Must be HH:MM' }, { status: 400 });
            }
        }

        if (body.scheduleDays && Array.isArray(body.scheduleDays)) {
            // week days (1-7) or month days (1-31)
            const isValidDays = body.scheduleDays.every((d: any) => typeof d === 'number' && d >= 1 && d <= 31);
            if (!isValidDays) {
                return NextResponse.json({ success: false, error: 'Invalid scheduleDays. Must be an array of numbers between 1 and 31' }, { status: 400 });
            }
        }

        const automation = await WaAutomation.create(body);

        return NextResponse.json({ success: true, data: automation });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
