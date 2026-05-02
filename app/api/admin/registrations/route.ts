import { NextRequest, NextResponse } from 'next/server';
import { getMasterModels } from '@/lib/masterDb';

function validatePin(request: NextRequest) {
    const headerPin = request.headers.get('x-admin-pin');
    const cookiePin = request.cookies.get('admin_pin')?.value;
    const pin = headerPin || cookiePin;

    if (!pin || pin !== process.env.ADMIN_PIN) {
        return false;
    }
    return true;
}

export async function GET(request: NextRequest) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized. PIN tidak valid.' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        
        const master = await getMasterModels();
        const query = status ? { status } : {};
        
        const registrations = await master.Registration.find(query).sort({ createdAt: -1 });

        // Don't send hashedPassword to client
        const safeRegistrations = registrations.map(reg => {
            const { hashedPassword, ...doc } = reg.toObject();
            return doc;
        });

        return NextResponse.json({ success: true, data: safeRegistrations });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
