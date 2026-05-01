import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTenantModels } from "@/lib/tenantDb";
import SetupForm from "./SetupForm";

export const metadata = {
    title: "Initial Setup - SalonNext",
    description: "Set up your administrator account",
};

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
    const headersList = await headers();
    const tenantSlug = headersList.get('x-store-slug') || 'pusat';
    const { User } = await getTenantModels(tenantSlug);

    // Check if any users already exist
    const userCount = await User.countDocuments();
    console.log(`🔍 [SetupPage] Checking user count: ${userCount}`);

    // If users exist, setup is already complete - redirect to login
    if (userCount > 0) {
        console.log('✅ Users found, redirecting away from setup');
        redirect(`/${tenantSlug}/login`);
    }

    return <SetupForm />;
}
