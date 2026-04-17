
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Role from "@/models/Role";

export async function GET() {
    try {
        await connectToDB();

        const newPermissions = {
            appointments: { view: "all", create: true, edit: true, delete: true },
            pos: { view: "all", create: true, edit: true, delete: true },
            services: { view: "all", create: true, edit: true, delete: true },
            products: { view: "all", create: true, edit: true, delete: true },
            staff: { view: "all", create: true, edit: true, delete: true },
            customers: { view: "all", create: true, edit: true, delete: true },
            suppliers: { view: "all", create: true, edit: true, delete: true },
            invoices: { view: "all", create: true, edit: true, delete: true },
            payroll: { view: "all", create: true, edit: true, delete: true },
            expenses: { view: "all", create: true, edit: true, delete: true },
            reports: { view: "all", create: true, edit: true, delete: true },
            dashboard: { view: true }, // Boolean as per IRole
            users: { view: "all", create: true, edit: true, delete: true },
            roles: { view: "all", create: true, edit: true, delete: true },
            staffSlots: { view: "all", create: true, edit: true, delete: true },
            aiReports: { view: true },
            settings: { view: true, edit: true }, // Boolean fields as per IRole
        };

        // Update Admin Role
        const adminRole = await Role.findOneAndUpdate(
            { name: "Admin" },
            { $set: { permissions: newPermissions, isSystem: true } },
            { new: true, upsert: true }
        );

        return NextResponse.json({ success: true, message: "Admin permissions updated", data: adminRole });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
