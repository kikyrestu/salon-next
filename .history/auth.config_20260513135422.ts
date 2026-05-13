import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    session: {
        strategy: "jwt",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const pathParts = nextUrl.pathname.split('/').filter(Boolean);
            // pathParts[0] could be a slug like "pusat", "bintaro", or "api"
            const isApiRoute = pathParts[0] === 'api';
            const slugSegment = !isApiRoute ? pathParts[0] : null;
            // The "page" part is the path after the slug, e.g. /pusat/login -> "login"
            const pageSegment = slugSegment ? pathParts.slice(1).join('/') : pathParts.join('/');

            const isRootOrRegister = nextUrl.pathname === '/' || nextUrl.pathname === '/register';

            const isPublicPage =
                isRootOrRegister ||
                pageSegment === 'login' ||
                pageSegment === 'register' ||
                pageSegment === 'setup' ||
                nextUrl.pathname.startsWith('/admin');

            const isPublicApi =
                nextUrl.pathname === '/api/setup' ||
                nextUrl.pathname === '/api/register' ||
                nextUrl.pathname === '/api/settings' ||
                nextUrl.pathname === '/api/payments/xendit/webhook' ||
                nextUrl.pathname.startsWith('/api/auth') ||
                nextUrl.pathname.startsWith('/api/public') ||
                nextUrl.pathname.startsWith('/api/admin');

            const isPublicRoute = isPublicPage || isPublicApi;

            // Redirect logic
            if (!isLoggedIn && !isPublicRoute) {
                // Redirect to /{slug}/login if slug is known, otherwise /pusat/login
                const loginSlug = slugSegment || 'pusat';
                return Response.redirect(new URL(`/${loginSlug}/login`, nextUrl));
            }

            if (isLoggedIn && (isRootOrRegister || pageSegment === 'login' || pageSegment === 'register')) {
                const dashSlug = slugSegment && !isRootOrRegister ? slugSegment : (auth?.user as any)?.tenantSlug || 'pusat';
                return Response.redirect(new URL(`/${dashSlug}/dashboard`, nextUrl));
            }

            return true;
        },
        async jwt({ token, user }) {
            // Hanya set token saat initial sign-in.
            // Permission refresh via DB dilakukan di auth.ts (Node.js runtime)
            // yang bisa menggunakan mongoose langsung — tanpa HTTP round-trip.
            if (user) {
                token.id = user.id;
                token.tenantSlug = (user as any).tenantSlug;
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
                session.user.tenantSlug = token.tenantSlug;
            }
            return session;
        },
    },
    providers: [], // Providers are added in auth.ts
} satisfies NextAuthConfig;