"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { useTransition } from "react";

export default function ActivityLogFilters({ initialSearch }: { initialSearch: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSearch = (term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("search", term);
        } else {
            params.delete("search");
        }
        params.set("page", "1"); // Reset to page 1

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50/50">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Search logs by action or resource..."
                    defaultValue={initialSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                />
                {isPending && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-900"></div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Optional filters can go here */}
                <button
                    onClick={() => {
                        router.push(pathname);
                    }}
                    className="w-full sm:w-auto text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2 bg-gray-100 sm:bg-transparent rounded-lg sm:rounded-none transition-colors"
                >
                    Reset All
                </button>
            </div>
        </div>
    );
}
