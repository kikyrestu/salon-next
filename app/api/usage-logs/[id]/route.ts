
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import UsageLog from "@/models/UsageLog";
import Product from "@/models/Product";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectToDB();
        initModels();
        const { id } = await params;

        const log = await UsageLog.findById(id);
        if (!log) {
            return NextResponse.json({ success: false, error: "Usage log not found" }, { status: 404 });
        }

        // Revert product stock
        const product = await Product.findById(log.product);
        if (product) {
            product.stock += log.quantity;
            await product.save();
        }

        await UsageLog.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Usage log deleted and stock reverted" });
    } catch (error: any) {
        console.error("API Error UsageLog DELETE:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
