"use client";

import { Plus, FileText, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface LowStockItem {
    _id: string;
    name: string;
    stock: number;
    alertLimit: number;
}

interface QuickActionsProps {
    lowStockItems?: LowStockItem[];
}

export default function QuickActions({ lowStockItems = [] }: QuickActionsProps) {
    return (
        <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                    <Link href="#" className="flex flex-col items-center justify-center p-4 bg-blue-900 rounded-lg text-white hover:bg-blue-800 transition-colors">
                        <Plus className="w-6 h-6 mb-2" />
                        <span className="text-sm font-medium">Add Product</span>
                    </Link>
                    <Link href="#" className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg text-green-700 hover:bg-green-100 transition-colors">
                        <FileText className="w-6 h-6 mb-2" />
                        <span className="text-sm font-medium">New Sale</span>
                    </Link>
                </div>
            </div>

            {/* Stock Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Low Stock Alerts</h3>
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {lowStockItems.length} Items
                    </span>
                </div>
                <div className="space-y-3">
                    {lowStockItems.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                            No low stock items
                        </div>
                    ) : (
                        lowStockItems.slice(0, 5).map((item) => (
                            <div key={item._id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center space-x-3">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                        <p className="text-xs text-red-600">Only {item.stock} left (Alert: {item.alertLimit})</p>
                                    </div>
                                </div>
                                <Link
                                    href="#"
                                    className="text-xs font-medium text-red-700 hover:text-red-900 bg-white px-2 py-1 rounded border border-red-200"
                                >
                                    View
                                </Link>
                            </div>
                        ))
                    )}
                </div>
                {lowStockItems.length > 5 && (
                    <div className="mt-3 text-center">
                        <Link href="#" className="text-sm text-blue-900 hover:text-blue-700 font-medium">
                            View all {lowStockItems.length} items →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
