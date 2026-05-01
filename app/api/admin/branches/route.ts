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
        const { Store } = await getMasterModels();
        const stores = await Store.find({}).sort({ createdAt: -1 }).select('-dbUri');
        return NextResponse.json({ success: true, data: stores });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, slug } = body;

        if (!name || !slug) {
            return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
        }

        const { Store } = await getMasterModels();

        // Check if slug exists
        const existing = await Store.findOne({ slug });
        if (existing) {
            return NextResponse.json({ success: false, error: 'Slug already exists' }, { status: 400 });
        }

        // Auto generate dbUri from MONGODB_URI
        const baseUri = process.env.MONGODB_URI;
        if (!baseUri) {
            throw new Error('MONGODB_URI is missing');
        }

        const url = new URL(baseUri);
        const uniqueSuffix = Date.now().toString(36);
        url.pathname = `/salon_${slug.replace(/[^a-z0-9-]/g, '')}_${uniqueSuffix}`;
        const dbUri = url.toString();

        const newStore = await Store.create({
            name,
            slug,
            dbUri,
            isActive: true
        });

        // Hide dbUri from response for security
        const { dbUri: _, ...storeData } = newStore.toObject();

        return NextResponse.json({ success: true, data: storeData }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
