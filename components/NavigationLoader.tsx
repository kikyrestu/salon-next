"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationLoader() {
    const [loading, setLoading] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        // Hide loader when route changes
        setLoading(false);
    }, [pathname]);

    useEffect(() => {
        // Intercept all link clicks
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a[href]') as HTMLAnchorElement;

            if (link && link.href) {
                const url = new URL(link.href);
                const currentUrl = new URL(window.location.href);

                // Only show loader for internal navigation to different pages
                if (url.origin === currentUrl.origin && url.pathname !== currentUrl.pathname) {
                    // Don't show for external links or same page
                    if (!link.target || link.target === '_self') {
                        setLoading(true);
                    }
                }
            }
        };

        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, []);

    if (!loading) return null;

    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                {/* Simple elegant spinner */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
                </div>

                {/* Clean text */}
                <p className="text-gray-700 font-semibold text-lg">Loading...</p>
            </div>
        </div>
    );
}
