"use client";

import { Calendar } from "lucide-react";

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
}

export default function DateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange
}: DateRangePickerProps) {
    return (
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-2 py-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter:</span>
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="px-2 py-1 text-sm border-none focus:ring-0 text-gray-600 bg-transparent"
                />
                <span className="text-gray-400">-</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="px-2 py-1 text-sm border-none focus:ring-0 text-gray-600 bg-transparent"
                />
            </div>
        </div>
    );
}
