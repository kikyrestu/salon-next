import { NextRequest, NextResponse } from 'next/server';
import { migratePermissionsForTenant } from '@/lib/migratePermissions';

async function migratePermissions(request: NextRequest) {
    try {
        const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
        const results = await migratePermissionsForTenant(tenantSlug);

        return NextResponse.json({
            success: true,
            message: `Force-migrated ${results.length} roles`,
            details: results,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// GET & POST both work
export async function GET(request: NextRequest) { return migratePermissions(request); }
export async function POST(request: NextRequest) { return migratePermissions(request); }