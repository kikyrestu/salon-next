import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';


// GET /api/roles/[id] - Get single role
export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Role, User } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;
        const role = await Role.findById(id);

        if (!role) {
            return NextResponse.json(
                { success: false, error: "Role not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: role });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/roles/[id] - Update role
export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Role, User } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;
        const body = await request.json();

        // Prevent modifying system roles significantly if needed
        // For now, we allow modifying permissions but maybe not the name of system roles
        const existingRole = await Role.findById(id);
        if (!existingRole) {
            return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
        }

        if (existingRole.isSystem && body.name && body.name !== existingRole.name) {
            return NextResponse.json(
                { success: false, error: "Cannot rename system roles" },
                { status: 400 }
            );
        }

        // Update the role
        if (body.name) existingRole.name = body.name;
        if (body.description !== undefined) existingRole.description = body.description;
        if (body.permissions) {
            existingRole.permissions = body.permissions;
            existingRole.markModified('permissions'); // Important for Mixed type
        }

        await existingRole.save();

        return NextResponse.json({ success: true, data: existingRole });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Role, User } = await getTenantModels(tenantSlug);

    try {
        
        const { id } = await props.params;

        const role = await Role.findById(id);
        if (!role) {
            return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
        }

        if (role.isSystem) {
            return NextResponse.json(
                { success: false, error: "Cannot delete system roles" },
                { status: 400 }
            );
        }

        // Check if users are assigned to this role
        const usersCount = await User.countDocuments({ role: id });
        if (usersCount > 0) {
            return NextResponse.json(
                { success: false, error: `Cannot delete role. It is assigned to ${usersCount} users.` },
                { status: 400 }
            );
        }

        await Role.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Role deleted successfully" });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
