import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/initModels';

// GET /api/users/[id] - Get single user
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;
        const user = await User.findById(id).select('-password').populate('role');

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/users/[id] - Update user
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;
        const body = await request.json();

        // If password is being updated, it will be hashed by the pre-save hook in the Model
        // However, findByIdAndUpdate DOES NOT trigger pre-save hooks.
        // pass: true/false logic should be handled carefully.

        let updateData = { ...body };

        // If password is explicitly empty string, remove it from update to avoid clearing it
        if (updateData.password === "") {
            delete updateData.password;
        }

        // To support password hashing, we should use save() pattern if password is changed,
        // OR manually hash it here if using findByIdAndUpdate.
        // For simplicity and safety with the existing model hook:

        const user: any = await User.findById(id);
        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        if (updateData.password) {
            user.password = updateData.password;
        }
        if (updateData.name) user.name = updateData.name;
        if (updateData.email) user.email = updateData.email;
        if (updateData.role) user.role = updateData.role;

        await user.save(); // Triggers pre-save hash if password modified

        return NextResponse.json({ success: true, data: user });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;

        // Prevent deleting yourself? (Middleware should handle that, but safety check here is good)
        // For now, simple delete.

        const user = await User.findByIdAndDelete(id);

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
