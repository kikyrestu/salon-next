import { useSession } from "next-auth/react";

type PermissionAction = 'create' | 'edit' | 'delete' | 'view';
type ViewScope = 'all' | 'own' | 'none';

export function usePermission() {
    const { data: session } = useSession();
    const permissions = session?.user?.permissions;

    const getPermission = (resource: string) => {
        if (!permissions) return undefined;
        return permissions[resource];
    };

    const roleName = session?.user?.role?.toLowerCase() || '';
    const isSuperAdmin = roleName === 'super admin' || roleName === 'superadmin' || roleName === 'admin' || roleName === 'owner';

    const canView = (resource: string): boolean => {
        if (isSuperAdmin) return true;
        const permission = getPermission(resource);
        if (!permission) return false;

        // Handle boolean view permissions (e.g., dashboard, settings)
        if (typeof permission.view === 'boolean') {
            return permission.view;
        }

        // Handle string scope permissions (e.g., sales, products)
        const scope = permission.view as ViewScope;
        return scope === 'all' || scope === 'own';
    };

    const viewScope = (resource: string): ViewScope => {
        if (isSuperAdmin) return 'all';
        const permission = getPermission(resource);
        if (!permission) return 'none';
        return permission.view || 'none';
    };

    const canCreate = (resource: string): boolean => {
        if (isSuperAdmin) return true;
        const permission = getPermission(resource);
        if (!permission) return false;
        return !!permission.create;
    };

    const canEdit = (resource: string): boolean => {
        if (isSuperAdmin) return true;
        const permission = getPermission(resource);
        if (!permission) return false;

        // Backward compatibility for older/partially seeded role docs.
        // Some roles may keep `edit: false` while `create`/`delete` are true.
        if (typeof permission.edit === 'boolean') {
            if (permission.edit) return true;
            if (permission.create || permission.delete) return true;
            return false;
        }

        return !!permission.create || !!permission.delete;
    };

    const canDelete = (resource: string): boolean => {
        if (isSuperAdmin) return true;
        const permission = getPermission(resource);
        if (!permission) return false;
        return !!permission.delete;
    };

    // Generic check
    const hasPermission = (resource: string, action: PermissionAction): boolean => {
        if (!permissions) return false;
        if (action === 'view') return canView(resource);
        if (action === 'create') return canCreate(resource);
        if (action === 'edit') return canEdit(resource);
        if (action === 'delete') return canDelete(resource);
        return false;
    };

    return {
        canView,
        viewScope,
        canCreate,
        canEdit,
        canDelete,
        hasPermission,
        user: session?.user
    };
}
