import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import ActivityLog from '@/models/ActivityLog';

export async function logActivity({
    req,
    action,
    resource,
    resourceId,
    details,
}: {
    req?: NextRequest;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
}) {
    try {
        const session: any = await auth();
        if (!session?.user?.id) return;

        await dbConnect();

        let ip = '';
        let userAgent = '';

        if (req) {
            ip = (req as any).ip || req.headers.get('x-forwarded-for') || '';
            userAgent = req.headers.get('user-agent') || '';
        }

        await ActivityLog.create({
            user: session.user.id,
            action,
            resource,
            resourceId,
            details,
            ip,
            userAgent,
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}
