import { getTenantModels } from "@/lib/tenantDb";

import { NextRequest, NextResponse } from "next/server";




import { checkPermission } from "@/lib/rbac";
import { validateAndSanitize, validationErrorResponse } from "@/lib/validation";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { UsageLog, Product, Staff } = await getTenantModels(tenantSlug);

    try {
        
        

        // Security Check
        const permissionError = await checkPermission(request, 'usage-logs', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Validation
        const validation = validateAndSanitize(body, {
            required: ['product', 'quantity', 'staff'],
            numberRange: [{ field: 'quantity', min: 1 }]
        });

        if (!validation.isValid) {
            return validationErrorResponse(validation.errors);
        }

        const { product: productId, quantity, staff: staffId } = validation.sanitizedData;

        // Check stock
        const product = await Product.findById(productId);
        if (!product) {
            return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
        }

        if (product.stock < quantity) {
            return NextResponse.json({ success: false, error: `Insufficient stock. Available: ${product.stock}` }, { status: 400 });
        }

        // Decrease stock
        product.stock -= quantity;
        await product.save();

        const usageLog = await UsageLog.create(validation.sanitizedData) as any;

        // Log Activity
        await logActivity({
            req: request,
            action: 'create',
            resource: 'UsageLog',
            resourceId: usageLog._id.toString(),
            details: `Used ${quantity} of ${product.name}`
        });

        return NextResponse.json({ success: true, data: usageLog });
    } catch (error) {
        console.error("API Error UsageLog POST:", error);
        return NextResponse.json({ success: false, error: "Failed to create usage log" }, { status: 500 });
    }
}

export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { UsageLog, Product, Staff } = await getTenantModels(tenantSlug);

    try {
        
        

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";

        const skip = (page - 1) * limit;
        const query: any = {};

        if (search) {
            const products = await Product.find({ name: { $regex: search, $options: "i" } }).select('_id');
            if (products.length > 0) {
                query.product = { $in: products.map(p => p._id) };
            }
        }

        const total = await UsageLog.countDocuments(query);
        const logs = await UsageLog.find(query)
            .populate('product', 'name sku')
            .populate('staff', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("API Error UsageLog GET:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch usage logs" }, { status: 500 });
    }
}
