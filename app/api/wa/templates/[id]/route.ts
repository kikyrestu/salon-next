import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import WaTemplate from '@/models/WaTemplate';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const permissionError = await checkPermission(request, 'services', 'edit');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;

        const body = await request.json();
        const name = String(body?.name || '').trim();
        const message = String(body?.message || '').trim();
        const requestedType = String(body?.templateType || '').trim();
        const isGreetingEnabled = Boolean(body?.isGreetingEnabled);

        if (!name || !message) {
            return NextResponse.json(
                { success: false, error: 'name and message are required' },
                { status: 400 }
            );
        }

        const existingTemplate = await WaTemplate.findById(id);
        if (!existingTemplate) {
            return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
        }

        const templateType = requestedType === 'greeting' || requestedType === 'follow_up'
            ? requestedType
            : (existingTemplate.templateType || (existingTemplate.isGreetingEnabled ? 'greeting' : 'follow_up'));

        if (isGreetingEnabled && templateType !== 'greeting') {
            return NextResponse.json(
                { success: false, error: 'Only greeting templates can be set as active greeting' },
                { status: 400 }
            );
        }

        if (isGreetingEnabled) {
            await WaTemplate.updateMany({ _id: { $ne: id } }, { $set: { isGreetingEnabled: false } });
        }

        const template = await WaTemplate.findByIdAndUpdate(
            id,
            { name, message, templateType, isGreetingEnabled },
            { new: true }
        );

        return NextResponse.json({ success: true, data: template });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to update WA template' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const permissionError = await checkPermission(request, 'services', 'delete');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;

        const template = await WaTemplate.findByIdAndDelete(id);
        if (!template) {
            return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to delete WA template' },
            { status: 500 }
        );
    }
}
