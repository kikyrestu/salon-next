"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import Footer from "@/components/dashboard/Footer";
import NavigationLoader from "@/components/NavigationLoader";

export default function DashboardLayout({
    children,
    user
}: {
    children: React.ReactNode;
    user?: { name?: string | null; email?: string | null };
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop state
    const pathname = usePathname();
    const isPosPage = pathname === "/pos" || pathname?.endsWith("/pos");

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const toggleCollapse = () => setIsSidebarCollapsed(!isSidebarCollapsed);

    if (isPosPage) {
        return (
            <div className="min-h-screen bg-gray-50">
                <NavigationLoader />
                <main>{children}</main>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Navigation Loading Overlay */}
            <NavigationLoader />

            {/* Sidebar */}
            <Sidebar
                isSidebarOpen={isSidebarOpen}
                isSidebarCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
            />

            {/* Main Content Area */}
            <div
                className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
                    }`}
            >
                <Header
                    toggleSidebar={toggleSidebar}
                    toggleCollapse={toggleCollapse}
                    isSidebarCollapsed={isSidebarCollapsed}
                    user={user}
                />

                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>

                <Footer />
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}
