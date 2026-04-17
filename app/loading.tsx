import React from "react";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-900 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-blue-900 font-medium animate-pulse">Loading...</p>
            </div>
        </div>
    );
}
