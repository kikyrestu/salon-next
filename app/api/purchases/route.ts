import { getTenantModels } from "@/lib/tenantDb";

import { NextResponse } from "next/server";





export async function POST(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Purchase, Product, Supplier } = await getTenantModels(tenantSlug);

    try {
        
        
        const body = await request.json();

        // Generate Purchase Number
        const count = await Purchase.countDocuments();
        const purchaseNumber = `PUR-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

        const purchase = new Purchase({
            ...body,
            purchaseNumber
        });

        // If status is received, update product stock
        if (purchase.status === 'received') {
            for (const item of purchase.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.quantity;
                    // Update cost price if needed? 
                    // Simple weighted average could be done here, but sticking to simple stock increase for now.
                    // Or just update the cost price to the new one?
                    // product.costPrice = item.costPrice; 
                    await product.save();
                }
            }
        }

        await purchase.save();

        return NextResponse.json({ success: true, data: purchase });
    } catch (error) {
        console.error("API Error Purchases POST:", error);
        return NextResponse.json({ success: false, error: "Failed to create purchase" }, { status: 500 });
    }
}

export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Purchase, Product, Supplier } = await getTenantModels(tenantSlug);

    try {
        
        

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "all";

        const skip = (page - 1) * limit;
        const query: any = {};

        if (status !== "all") {
            query.status = status;
        }

        if (search) {
            const searchQueries: any[] = [
                { purchaseNumber: { $regex: search, $options: "i" } }
            ];

            // Search by supplier
            const suppliers = await Supplier.find({ name: { $regex: search, $options: "i" } }).select('_id');
            if (suppliers.length > 0) {
                searchQueries.push({ supplier: { $in: suppliers.map(s => s._id) } });
            }

            query.$or = searchQueries;
        }

        const total = await Purchase.countDocuments(query);
        const purchases = await Purchase.find(query)
            .populate('supplier', 'name')
            .populate('items.product', 'name') // Populate product details if needed
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: purchases,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("API Error Purchases GET:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch purchases" }, { status: 500 });
    }
}
