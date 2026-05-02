import { NextRequest, NextResponse } from 'next/server';
import { getMasterModels } from '@/lib/masterDb';

function validatePin(request: NextRequest) {
    const headerPin = request.headers.get('x-admin-pin');
    const cookiePin = request.cookies.get('admin_pin')?.value;
    const pin = headerPin || cookiePin;
    const correctPin = process.env.ADMIN_PIN || '123456';
    return pin === correctPin;
}

export async function GET(request: NextRequest) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const master = await getMasterModels();
        let settings = await master.AdminSettings.findOne();
        
        if (!settings) {
            settings = await master.AdminSettings.create({
                fonnteToken: '',
                adminPhone: '',
                adminName: 'Admin',
            });
        }

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { fonnteToken, adminPhone, adminName } = body;

        const master = await getMasterModels();
        
        const settings = await master.AdminSettings.findOneAndUpdate(
            {}, 
            { $set: { fonnteToken, adminPhone, adminName } },
            { new: true, upsert: true }
        );

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
