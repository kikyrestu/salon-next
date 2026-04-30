import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';
import WaAutomation from '@/models/WaAutomation';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const permError = await checkPermission(request, 'settings', 'edit');
    if (permError) return permError;

    try {
        const { id } = await params;
        await connectToDB();
        initModels();

        const body = await request.json();
        
        const automation = await WaAutomation.findByIdAndUpdate(id, body, { new: true });
        if (!automation) {
            return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: automation });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const permError = await checkPermission(request, 'settings', 'edit');
    if (permError) return permError;

    try {
        const { id } = await params;
        await connectToDB();
        initModels();

        const automation = await WaAutomation.findByIdAndDelete(id);
        if (!automation) {
            return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Automation deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
