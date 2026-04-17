import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

type Action = 'view' | 'create' | 'edit' | 'delete';

export async function checkPermission(
    request: NextRequest,
    resource: string,
    action: Action
): Promise<NextResponse | null> {
    const session: any = await auth();

    if (!session || !session.user) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { permissions, role } = session.user;

    // Check for super admin role - grants all permissions
    if (role === 'Super Admin' || (session.user.role && session.user.role.name === 'Super Admin')) {
        return null; // Allow all actions for super admin
    }

    // If no permission object, assume restricted
    if (!permissions) {
        return NextResponse.json(
            { success: false, error: "Access Denied: No permissions found" },
            { status: 403 }
        );
    }

    const resourcePerms = permissions[resource];
    if (!resourcePerms) {
        return NextResponse.json(
            { success: false, error: "Access Denied: Resource restricted" },
            { status: 403 }
        );
    }

    let allowed = false;
    if (action === 'view') {
        allowed = resourcePerms.view !== 'none';
    } else {
        allowed = !!resourcePerms[action];
    }

    if (!allowed) {
        return NextResponse.json(
            { success: false, error: `Access Denied: Cannot ${action} ${resource}` },
            { status: 403 }
        );
    }

    return null; // Null means pass/allowed
}

// Enhanced permission check that includes data ownership
export async function checkResourceOwnership(
    request: NextRequest,
    resource: string,
    action: Action,
    resourceId?: string,
    ownerId?: string
): Promise<NextResponse | null> {
    // First check basic permissions
    const permissionError = await checkPermission(request, resource, action);
    if (permissionError) return permissionError;
    
    const session: any = await auth();
    
    // If user has 'all' view permissions or is super admin, allow
    if (session.user.role === 'Super Admin' || 
        (session.user.role && session.user.role.name === 'Super Admin') ||
        session.user.permissions?.[resource]?.view === 'all') {
        return null;
    }
    
    // If user has 'own' view permissions, check ownership
    if (session.user.permissions?.[resource]?.view === 'own' && ownerId) {
        if (ownerId.toString() !== session.user.id) {
            return NextResponse.json(
                { success: false, error: "Access Denied: You can only access your own resources" },
                { status: 403 }
            );
        }
    }
    
    return null;
}

// Helper to get view scope for filtering data
export async function getViewScope(resource: string): Promise<'all' | 'own' | 'none'> {
    const session: any = await auth();
    if (!session?.user) return 'none';
    
    // Super admin can view all
    if (session.user.role === 'Super Admin' || 
        (session.user.role && session.user.role.name === 'Super Admin')) {
        return 'all';
    }
    
    if (!session?.user?.permissions) return 'none';
    return session.user.permissions[resource]?.view || 'none';
}

// Helper to get current user ID
export async function getCurrentUserId(): Promise<string | null> {
    const session: any = await auth();
    return session?.user?.id || null;
}
