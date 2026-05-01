import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { checkPermission } from '@/lib/rbac';

// GET /api/settings - Get store settings
export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Settings } = await getTenantModels(tenantSlug);

    try {
        

        // Check if user is authenticated for full settings access
        const session = await auth();

        // Find the first settings document
        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({
                storeName: 'SalonNext',
                currency: 'USD',
                timezone: 'UTC',
                taxRate: 0
            });
        }

        // If not authenticated, only return basic public info
        if (!session) {
            return NextResponse.json({
                success: true,
                data: {
                    storeName: settings.storeName,
                    logoUrl: settings.logoUrl,
                    address: settings.address,
                    phone: settings.phone,
                    email: settings.email,
                    website: settings.website,
                    businessHours: settings.businessHours,
                    currency: settings.currency,
                    timezone: settings.timezone
                }
            });
        }

        // If authenticated, check for settings view permission before returning full data
        const permissionError = await checkPermission(request, 'settings', 'view');
        if (permissionError) return permissionError;

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        console.error('Error fetching settings:', error);

        if (error?.name === 'MongooseServerSelectionError') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Database is unavailable. Please ensure MongoDB is running and MONGODB_URI is correct.'
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/settings - Update store settings
export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Settings } = await getTenantModels(tenantSlug);

    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        

        // Check Permissions
        // Settings edit uses 'edit' permission
        const permissionError = await checkPermission(request, 'settings', 'edit');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Sanitize Mongoose ObjectIds that might be sent as empty strings
        if (body.birthdayVoucherId === "") {
            body.birthdayVoucherId = null;
        }

        // Update the first document found (singleton pattern)
        // upsert: true ensures it creates one if it doesn't exist (though GET handles creation usually)
        const settings = await Settings.findOneAndUpdate(
            {},
            body,
            { new: true, upsert: true, runValidators: true }
        );

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        console.error('Error updating settings:', error);

        if (error?.name === 'MongooseServerSelectionError') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Database is unavailable. Please ensure MongoDB is running and MONGODB_URI is correct.'
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
