"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from "recharts";

import { useSettings } from "@/components/providers/SettingsProvider";

interface SalesChartProps {
    data: any[];
    type?: "area" | "bar";
    height?: number;
    dataKey: string;
    xAxisKey?: string;
    color?: string;
}

export default function SalesChart({
    data,
    type = "area",
    height = 300,
    dataKey,
    xAxisKey = "date",
    color = "#3b82f6"
}: SalesChartProps) {
    const { settings } = useSettings();
    if (!data || data.length === 0) {
        return (
            <div className={`flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200`} style={{ height }}>
                <p className="text-gray-400">No data available</p>
            </div>
        );
    }

    const ChartComponent = type === "area" ? AreaChart : BarChart;

    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer>
                <ChartComponent data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                        dataKey={xAxisKey}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickFormatter={(value) => `${settings.symbol}${value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: number) => [`${settings.symbol}${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`, 'Amount']}
                    />
                    {type === "area" ? (
                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            fillOpacity={1}
                            fill="url(#colorGradient)"
                            strokeWidth={2}
                        />
                    ) : (
                        <Bar
                            dataKey={dataKey}
                            fill={color}
                            radius={[4, 4, 0, 0]}
                        />
                    )}
                </ChartComponent>
            </ResponsiveContainer>
        </div>
    );
}
