
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function protectAPI(req: Request) {
    const session = await auth();

    if (!session || !session.user) {
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: "Unauthorized: Please log in" },
                { status: 401 }
            )
        };
    }

    return {
        authorized: true,
        user: session.user,
        response: null
    };
}
