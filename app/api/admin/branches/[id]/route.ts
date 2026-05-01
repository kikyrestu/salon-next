import { NextRequest, NextResponse } from 'next/server';
import { getMasterModels } from '@/lib/masterDb';

function validatePin(request: NextRequest) {
    const headerPin = request.headers.get('x-admin-pin');
    const cookiePin = request.cookies.get('admin_pin')?.value;
    const pin = headerPin || cookiePin;
    const correctPin = process.env.ADMIN_PIN || '123456';
    return pin === correctPin;
}

export async function PUT(request: NextRequest, props: any) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await props.params;
        const body = await request.json();
        
        if (body.isActive === undefined) {
            return NextResponse.json({ success: false, error: 'isActive is required' }, { status: 400 });
        }

        const { Store } = await getMasterModels();
        const store = await Store.findById(id);

        if (!store) {
            return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
        }

        if (store.slug === 'pusat') {
            return NextResponse.json({ success: false, error: 'Cabang Pusat tidak bisa dinonaktifkan' }, { status: 403 });
        }

        store.isActive = body.isActive;
        await store.save();

        return NextResponse.json({ success: true, data: store });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await props.params;
        const { Store } = await getMasterModels();
        const store = await Store.findById(id);

        if (!store) {
            return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
        }

        if (store.slug === 'pusat') {
            return NextResponse.json({ success: false, error: 'Cabang Pusat tidak bisa dihapus' }, { status: 403 });
        }

        await Store.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: 'Branch deleted from Master DB' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
