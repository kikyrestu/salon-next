import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import SalesMaterial from "@/models/SalesMaterial";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
    try {
        const permissionError = await checkPermission(request, 'products', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search");

        const query: any = { isActive: true };
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const total = await SalesMaterial.countDocuments(query);
        const materials = await SalesMaterial.find(query)
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: materials,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch sales materials" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const permissionError = await checkPermission(request, 'products', 'create');
        if (permissionError) return permissionError;

        await connectToDB();
        const body = await request.json();

        if (!body.name || !body.code || body.price === undefined) {
             return NextResponse.json({ success: false, error: "Name, Code, and Price are required" }, { status: 400 });
        }

        const product = await SalesMaterial.create(body);
        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        console.error('Error creating sales material:', error);
        
        if (error.code === 11000) {
            return NextResponse.json({ success: false, error: "Material Code already exists" }, { status: 400 });
        }

        return NextResponse.json({ success: false, error: error.message || "Failed to create sales material" }, { status: 500 });
    }
}
