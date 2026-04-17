import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role?: any;
            permissions?: any;
        } & DefaultSession["user"];
    }

    interface User {
        id: string;
        role?: any;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role?: any;
        permissions?: any;
        roleId?: string;
    }
}
