import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import * as Models from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';
import { logActivity } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'settings', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        const models = Models.initModels();

        const backupData: any = {};

        // Loop through all models and fetch data
        for (const [name, model] of Object.entries(models)) {
            backupData[name] = await (model as any).find({});
        }

        // Log Activity
        await logActivity({
            req: request,
            action: 'export',
            resource: 'Database',
            details: 'Exported full database backup'
        });

        return new NextResponse(JSON.stringify(backupData, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename=salon-backup-${new Date().toISOString().split('T')[0]}.json`,
            },
        });
    } catch (error: any) {
        console.error('Backup error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
