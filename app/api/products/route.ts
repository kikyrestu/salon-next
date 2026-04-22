// app/api/products/routes.tsx

import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Product from "@/models/Product";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";
import { validateAndSanitize, validationErrorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'products', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search");

        const query: any = { status: "active" };
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: products,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'products', 'create');
        if (permissionError) return permissionError;

        await connectToDB();
        const body = await request.json();

        // Validate and sanitize input
        const validation = validateAndSanitize(body, {
            required: ['name', 'price', 'costPrice', 'stock'],
            numberRange: [
                { field: 'price', min: 0 },
                { field: 'costPrice', min: 0 },
                { field: 'stock', min: 0 }
            ],
            maxLength: [
                { field: 'name', length: 100 },
                { field: 'description', length: 500 },
                { field: 'category', length: 50 },
                { field: 'sku', length: 50 }
            ]
        });

        if (!validation.isValid) {
            return validationErrorResponse(validation.errors);
        }

        const product = await Product.create(validation.sanitizedData);
        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        console.error('Error creating product:', error);
        return NextResponse.json({ success: false, error: error.message || "Failed to create product" }, { status: 500 });
    }
}
