import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
    matcher: ["/((?!api/auth|api/fonnte/webhook|api/wa/trigger|api/wa/greeting-logs|_next/static|_next/image|favicon.ico).*)"],
};
