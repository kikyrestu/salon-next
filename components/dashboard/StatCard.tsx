import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    color: "blue" | "green" | "purple" | "orange" | "red";
}

const colorMap = {
    blue: "bg-blue-50 text-blue-900",
    green: "bg-green-500/10 text-green-600",
    purple: "bg-purple-500/10 text-purple-600",
    orange: "bg-orange-500/10 text-orange-600",
    red: "bg-red-500/10 text-red-600",
};

export default function StatCard({ title, value, icon: Icon, trend, trendUp, color }: StatCardProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
                </div>
                <div className={`p-3 rounded-lg ${colorMap[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            {trend && (
                <div className="mt-4 flex items-center text-sm">
                    <span className={`font-medium ${trendUp ? "text-green-600" : "text-red-600"}`}>
                        {trendUp ? "+" : ""}{trend}
                    </span>
                    <span className="text-gray-400 ml-2">from last month</span>
                </div>
            )}
        </div>
    );
}
