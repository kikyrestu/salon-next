
"use client";

import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

import { useSettings } from "@/components/providers/SettingsProvider";

interface ServiceChartProps {
    data: {
        name: string;
        revenue: number;
    }[];
}

const COLORS = [
    '#8B7355', // Khaki Dark / Brown
    '#A08865',
    '#B59D75', // Khaki Gold
    '#C1A982',
    '#D2BB94', // Khaki Light
    '#E3CCA6'
];

export default function ServiceChart({ data }: ServiceChartProps) {
    const { settings } = useSettings();
    // Take top 6 services for the chart
    const displayData = data.slice(0, 6);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-80">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Service Revenue Distribution</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={displayData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="revenue"
                        >
                            {displayData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [`${settings.symbol}${value.toLocaleString()}`, 'Revenue']}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-xs font-medium text-gray-600">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
