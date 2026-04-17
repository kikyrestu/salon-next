
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Purchase from "@/models/Purchase";
import Product from "@/models/Product";
import Supplier from "@/models/Supplier";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await connectToDB();
        initModels();

        const purchase = await Purchase.findById(id)
            .populate('supplier')
            .populate('items.product')
            .populate('createdBy', 'name');

        if (!purchase) {
            return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: purchase });
    } catch (error) {
        console.error("API Error Purchases Single GET:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch purchase" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await connectToDB();
        initModels();

        const purchase = await Purchase.findById(id);

        if (!purchase) {
            return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
        }

        // If status was received, we need to revert the stock increase
        if (purchase.status === 'received') {
            for (const item of purchase.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock -= item.quantity;
                    // Note: We don't check for negative stock here because a purchase might be deleted
                    // for correction, and the user might be aware of the stock status.
                    await product.save();
                }
            }
        }

        await Purchase.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Purchase deleted successfully" });
    } catch (error) {
        console.error("API Error Purchases Single DELETE:", error);
        return NextResponse.json({ success: false, error: "Failed to delete purchase" }, { status: 500 });
    }
}
