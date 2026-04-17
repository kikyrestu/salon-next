
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";

export async function GET() {
    try {
        await connectToDB();
        const models = initModels();
        // Try to perform a simple operation on a new model
        // @ts-ignore
        const purchaseCount = await models.Purchase.countDocuments();

        return NextResponse.json({
            success: true,
            message: "Database and Models loaded successfully",
            models: Object.keys(models),
            purchaseCount
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
