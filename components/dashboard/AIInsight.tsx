"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCcw, BrainCircuit, Lightbulb } from "lucide-react";

export default function AIInsight() {
    const [insight, setInsight] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchInsight = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ai-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: "Give me a very short (2-3 sentences) strategic insight for today based on the salon's current performance and stock levels. Focus on revenue growth.",
                    timeRange: '30'
                })
            });
            const data = await res.json();
            if (data.success) {
                setInsight(data.analysis);
            } else {
                setInsight("Configure your AI settings to see personalized business insights here.");
            }
        } catch (error) {
            console.error("AI Insight error:", error);
            setInsight("AI is currently taking a nap. Check back later!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsight();
    }, []);

    return (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                <BrainCircuit className="w-32 h-32" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Sparkles className="w-5 h-5 text-blue-200" />
                        </div>
                        <h3 className="font-bold text-lg tracking-tight">AI Business Assistant</h3>
                    </div>
                    <button
                        onClick={fetchInsight}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        title="Refresh Insight"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2 animate-pulse"></div>
                    </div>
                ) : (
                    <div className="flex gap-4">
                        <div className="shrink-0">
                            <Lightbulb className="w-6 h-6 text-yellow-400" />
                        </div>
                        <p className="text-blue-50 text-sm leading-relaxed font-medium italic">
                            "{insight}"
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
