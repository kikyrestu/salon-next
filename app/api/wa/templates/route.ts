import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaTemplate } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'services', 'view');
        if (permissionError) return permissionError;

        

        const { searchParams } = new URL(request.url);
        const search = String(searchParams.get('search') || '').trim();
        const type = String(searchParams.get('type') || '').trim();
        const templateType = type === 'greeting' || type === 'follow_up' ? type : '';

        const query: any = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (templateType === 'follow_up') {
            query.$or = [
                { templateType: 'follow_up' },
                { templateType: { $exists: false } }, // legacy templates before templateType exists
            ];
        } else if (templateType === 'greeting') {
            query.$or = [
                { templateType: 'greeting' },
                { templateType: { $exists: false }, isGreetingEnabled: true }, // legacy greeting template
            ];
        }

        const templates = await WaTemplate.find(query).sort({ createdAt: -1 });

        return NextResponse.json({ success: true, data: templates });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to fetch WA templates' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaTemplate } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'services', 'create');
        if (permissionError) return permissionError;

        

        const body = await request.json();
        const name = String(body?.name || '').trim();
        const message = String(body?.message || '').trim();
        const requestedType = String(body?.templateType || '').trim();
        const templateType = requestedType === 'greeting' || requestedType === 'follow_up'
            ? requestedType
            : (Boolean(body?.isGreetingEnabled) ? 'greeting' : 'follow_up');
        const isGreetingEnabled = Boolean(body?.isGreetingEnabled);

        if (!name || !message) {
            return NextResponse.json(
                { success: false, error: 'name and message are required' },
                { status: 400 }
            );
        }

        if (isGreetingEnabled && templateType !== 'greeting') {
            return NextResponse.json(
                { success: false, error: 'Only greeting templates can be set as active greeting' },
                { status: 400 }
            );
        }

        if (isGreetingEnabled) {
            await WaTemplate.updateMany({}, { $set: { isGreetingEnabled: false } });
        }

        const template = await WaTemplate.create({ name, message, templateType, isGreetingEnabled });

        return NextResponse.json({ success: true, data: template });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to create WA template' },
            { status: 500 }
        );
    }
}
