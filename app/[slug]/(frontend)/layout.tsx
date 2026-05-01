import { auth } from "@/auth";
import ClientLayout from "./ClientLayout";

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const user = session?.user ? {
        name: session.user.name,
        email: session.user.email
    } : undefined;

    return (
        <ClientLayout user={user}>
            {children}
        </ClientLayout>
    );
}
