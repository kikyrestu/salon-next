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
                    // Get models for specific tenant
                    const { User, Role } = await getTenantModels(slug);

                    // Find user and include password field & role
                    const user: any = await User.findOne({
                        email
                    }).select('+password').populate('role');

                    if (!user) {
                        throw new Error("Invalid email or password");
                    }

                    // Check password
                    const isPasswordValid = await user.comparePassword(password);

                    if (!isPasswordValid) {
                        throw new Error("Invalid email or password");
                    }

                    // Return user object
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
    // Keep specialized callbacks that need DB here if they can't be in config
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user, trigger, session }) {
            // Initial sign in or manual update
            if (user) {
                token.id = user.id;
                token.tenantSlug = (user as any).tenantSlug;
                if (user.role) {
                    token.role = user.role.name;
                    token.permissions = user.role.permissions;
                    token.roleId = user.role._id?.toString() || user.role.id;
                }
            } else if (trigger === "update" || !token.permissions) {
                // Only refresh permissions if explicitly updated or missing
                if (token.roleId && typeof token.roleId === 'string' && token.tenantSlug) {
                    try {
                        const { Role } = await getTenantModels(token.tenantSlug as string);
                        const role = await Role.findById(token.roleId);
                        if (role) {
                            token.role = role.name;
                            token.permissions = role.permissions;
                        }
                    } catch (error) {
                        console.error("Error refreshing permissions in JWT callback:", error);
                    }
                }
            }

            return token;
        },
    }
});
