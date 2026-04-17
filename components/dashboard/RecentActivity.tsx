import { Package, ShoppingCart, AlertCircle } from "lucide-react";

interface Activity {
    id: string;
    type: "sale" | "restock" | "low_stock";
    product: string;
    quantity: number;
    time: string;
}

interface RecentActivityProps {
    activities?: Activity[];
}

export default function RecentActivity({ activities = [] }: RecentActivityProps) {
    if (activities.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                <div className="text-center py-8 text-gray-500 text-sm">
                    No recent activity
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
                {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                        <div className={`p-2 rounded-full shrink-0 ${activity.type === "sale" ? "bg-green-100 text-green-600" :
                            activity.type === "restock" ? "bg-blue-900 text-white" :
                                "bg-orange-100 text-orange-600"
                            }`}>
                            {activity.type === "sale" && <ShoppingCart className="w-4 h-4" />}
                            {activity.type === "restock" && <Package className="w-4 h-4" />}
                            {activity.type === "low_stock" && <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                                {activity.type === "sale" ? "New Sale" :
                                    activity.type === "restock" ? "Stock Added" :
                                        "Low Stock Alert"}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                                {activity.product}
                                <span className="font-medium text-gray-700 mx-1">
                                    ({activity.type === "sale" ? "-" : ""}{activity.quantity})
                                </span>
                            </p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
