import { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

type Action = 'view' | 'create' | 'edit' | 'delete';

interface PermissionGateProps {
    children: ReactNode;
    resource: string;
    action?: Action;
    fallback?: ReactNode;
}

export default function PermissionGate({
    children,
    resource,
    action = 'view',
    fallback = null
}: PermissionGateProps) {
    const { hasPermission } = usePermission();

    if (hasPermission(resource, action)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
