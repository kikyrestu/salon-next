import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import SetupForm from "./SetupForm";

export const metadata = {
    title: "Initial Setup - SalonNext",
    description: "Set up your administrator account",
};

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
    await dbConnect();
    const { User } = initModels();

    // Check if any users already exist
    const userCount = await User.countDocuments();
    console.log(`🔍 [SetupPage] Checking user count: ${userCount}`);

    // If users exist, setup is already complete - redirect to login
    if (userCount > 0) {
        console.log('✅ Users found, redirecting away from setup');
        redirect("/login");
    }

    return <SetupForm />;
}
