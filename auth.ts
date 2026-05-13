import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getTenantModels } from "@/lib/tenantDb";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                slug: { label: "Slug", type: "text" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password || !credentials?.slug) {
                    throw new Error("Please provide email, password, and branch slug");
                }

                const email = String(credentials.email).toLowerCase().trim();
                const password = String(credentials.password);
                const slug = String(credentials.slug).toLowerCase().trim();

                try {
                    const { User } = await getTenantModels(slug);

                    const user: any = await User.findOne({ email })
                        .select('+password')
                        .populate('role');

                    if (!user) {
                        throw new Error("Invalid email or password");
                    }

                    const isPasswordValid = await user.comparePassword(password);
                    if (!isPasswordValid) {
                        throw new Error("Invalid email or password");
                    }

                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        tenantSlug: slug
                    };
                } catch (error) {
                    console.error("Authentication error:", error);
                    throw error;
                }
            },
        }),
    ],
    callbacks: {
        // `authorized` dan `session` diwariskan dari authConfig.callbacks
        ...authConfig.callbacks,

        /**
         * JWT Callback - berjalan di Node.js runtime (bisa pakai mongoose).
         *
         * Strategi refresh permissions:
         * - Saat sign-in awal: langsung set dari user object
         * - Setelah itu: refresh dari DB setiap REFRESH_INTERVAL_MS (default 5 menit)
         *   atau saat `trigger === 'update'` (admin trigger manual)
         *
         * TIDAK menggunakan HTTP fetch ke /api/roles — direct DB query via getTenantModels.
         */
        async jwt({ token, user, trigger }: any) {
            // --- Initial sign in ---
            if (user) {
                token.id = user.id;
                token.tenantSlug = user.tenantSlug;
                if (user.role) {
                    token.role = user.role.name;
                    token.permissions = user.role.permissions;
                    token.roleId = user.role._id?.toString() || user.role.id;
                }
                token.permissionsRefreshedAt = Date.now();
                return token;
            }

            // --- Periodic refresh dari DB (max setiap 5 menit) ---
            const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
            const lastRefresh = (token.permissionsRefreshedAt as number) || 0;

            const shouldRefresh =
                trigger === 'update' ||
                !token.permissions ||
                Date.now() - lastRefresh > REFRESH_INTERVAL_MS;

            if (shouldRefresh && token.roleId && token.tenantSlug) {
                try {
                    const { Role } = await getTenantModels(token.tenantSlug as string);
                    const role = await Role.findById(token.roleId).lean() as any;
                    if (role) {
                        token.role = role.name;
                        token.permissions = role.permissions;
                        token.permissionsRefreshedAt = Date.now();
                    }
                } catch (error) {
                    // Silently fail — pakai permissions lama dari token
                    console.error('[Auth] Error refreshing permissions from DB:', error);
                }
            }

            return token;
        },
    }
});