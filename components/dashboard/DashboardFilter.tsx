"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

export default function DashboardFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentRange = searchParams.get("range") || "today";

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== "today") {
            params.set("range", value);
        } else {
            params.delete("range");
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
                value={currentRange}
                onChange={handleChange}
                className="bg-transparent border-none text-gray-700 font-medium focus:ring-0 cursor-pointer outline-none pl-1"
            >
                <option value="today">Hari Ini</option>
                <option value="7d">7 Hari Terakhir</option>
                <option value="30d">30 Hari Terakhir</option>
                <option value="this_month">Bulan Ini</option>
                <option value="this_year">Tahun Ini</option>
            </select>
        </div>
    );
}
