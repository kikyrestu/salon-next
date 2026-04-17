import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        label: string;
        positive?: boolean;
    };
    color?: "blue" | "green" | "red" | "orange" | "purple";
    loading?: boolean;
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    color = "blue",
    loading = false
}: StatCardProps) {

    const colorStyles = {
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        green: "bg-green-50 text-green-600 border-green-100",
        red: "bg-red-50 text-red-600 border-red-100",
        orange: "bg-orange-50 text-orange-600 border-orange-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100",
    };

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-24 bg-gray-200 rounded"></div>
                    <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">{title}</h3>
                <div className={`p-2 rounded-lg ${colorStyles[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    {trend && (
                        <div className={`flex items-center gap-1 mt-1 text-sm ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                            <span className="font-medium">
                                {trend.positive ? '+' : ''}{trend.value}%
                            </span>
                            <span className="text-gray-500">{trend.label}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
