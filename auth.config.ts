import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;

            // Define public routes
            const isPublicRoute =
                nextUrl.pathname === "/login" ||
                nextUrl.pathname === "/register" ||
                nextUrl.pathname === "/setup" ||
                nextUrl.pathname === "/api/setup" ||
                nextUrl.pathname === "/api/settings" ||
                nextUrl.pathname === "/api/payments/xendit/webhook" ||
                nextUrl.pathname.startsWith("/api/auth") ||
                nextUrl.pathname.startsWith("/api/public");

            // Redirect logic
            if (!isLoggedIn && !isPublicRoute) {
                return false; // Redirects to login page
            }

            if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
                return Response.redirect(new URL("/dashboard", nextUrl));
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                if (user.role) {
                    token.role = user.role.name;
                    token.permissions = user.role.permissions;
                    token.roleId = user.role._id?.toString() || user.role.id;
                }
            }
            return token;
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.permissions = token.permissions;
            }
            return session;
        },
    },
    providers: [], // Providers are added in auth.ts
} satisfies NextAuthConfig;
