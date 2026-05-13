
"use client";


import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Sparkles, Send, Loader2, TrendingUp, AlertTriangle, Lightbulb, PieChart, RefreshCw } from "lucide-react";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";

export default function AIReportsPage() {
  const params = useParams();
  const slug = params.slug as string;
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState("");
    const [error, setError] = useState("");
    const [timeRange, setTimeRange] = useState("30");
    const [aiEnabled, setAiEnabled] = useState(true);

    useEffect(() => {
        checkSettings();
    }, []);

    const checkSettings = async () => {
        try {
            const res = await fetch("/api/settings", { headers: { "x-store-slug": slug } });
            const data = await res.json();
            if (data.success && !data.data.aiEnabled) {
                setAiEnabled(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const generateAnalysis = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError("");
        setAnalysis("");

        try {
            const res = await fetch("/api/ai-reports", {
                method: "POST",
                headers: { "x-store-slug": slug, "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, timeRange }),
            });
            const data = await res.json();
            if (data.success) {
                setAnalysis(data.analysis);
            } else {
                setError(data.error || "Failed to generate AI analysis");
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!aiEnabled) {
        return (
            <div className="max-w-4xl mx-auto p-8 text-center">
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-12 shadow-sm">
                    <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">AI Reporting is Disabled</h1>
                    <p className="text-gray-600 mb-8">
                        Experience the power of business intelligence with AI. Enable OpenAI integration in your settings to get started.
                    </p>
                    <a
                        href="/settings"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
                    >
                        Go to Settings
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                        AI Power Reports
                    </h1>
                    <p className="text-gray-500">Intelligent business analysis and strategic insights</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="bg-white text-gray-900 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="365">This Year</option>
                    </select>
                    <FormButton
                        onClick={() => generateAnalysis()}
                        loading={loading}
                        variant="purple"
                        icon={<RefreshCw className="w-4 h-4" />}
                    >
                        Refresh Analysis
                    </FormButton>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Interactive AI Chat */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Lightbulb className="w-12 h-12 text-purple-600" />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-4">Strategic Assistant</h3>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            Ask specific questions about your salon performance, inventory levels, or revenue trends.
                        </p>
                        <form onSubmit={generateAnalysis} className="space-y-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. How can I improve service revenue next month?"
                                className="w-full h-32 px-4 py-3 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none text-sm"
                            />
                            <FormButton
                                type="submit"
                                loading={loading}
                                className="w-full py-3"
                                icon={<Send className="w-4 h-4" />}
                            >
                                Ask AI Assistant
                            </FormButton>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <span className="text-xs font-medium text-blue-800">Growth Analysis Included</span>
                        </div>
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <span className="text-xs font-medium text-red-800">Inventory Risks Tracked</span>
                        </div>
                    </div>
                </div>

                {/* Right: AI Analysis Output */}
                <div className="lg:col-span-2">
                    {loading ? (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 h-full flex flex-col items-center justify-center text-center">
                            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-6" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Business Data...</h3>
                            <p className="text-gray-500 max-w-sm">
                                AI is crunching your numbers and generating strategic recommendations. This may take a few seconds.
                            </p>
                        </div>
                    ) : analysis ? (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm font-semibold text-gray-900">AI Intelligent Insights</span>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">
                                    Generated for {timeRange} Days
                                </span>
                            </div>
                            <div className="flex-1 p-12 overflow-y-auto bg-gray-50">
                                <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
                                    {/* Report Header */}
                                    <div className="bg-white border-b border-gray-300 px-12 py-8">
                                        <div className="text-center mb-6">
                                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">BUSINESS INTELLIGENCE REPORT</h1>
                                            <div className="w-24 h-1 bg-gray-400 mx-auto mb-4"></div>
                                            <p className="text-gray-600 text-lg">Generated Analysis for {timeRange} Days</p>
                                            <p className="text-gray-500 text-sm mt-1">Prepared by AI-Powered Business Analytics</p>
                                        </div>
                                    </div>
                                    
                                    {/* Report Content */}
                                    <div className="px-12 py-10">
                                        <div className="space-y-10">
                                            {analysis.split('\n\n').map((paragraph, paraIndex) => {
                                                const trimmedParagraph = paragraph.trim();
                                                if (!trimmedParagraph) return null;
                                                
                                                // Check if it's a numbered section (e.g., "1. Executive Summary")
                                                if (trimmedParagraph.match(/^\d+\./)) {
                                                    const [titleLine, ...contentLines] = trimmedParagraph.split('\n');
                                                    const title = titleLine.replace(/^\d+\.\s*/, '');
                                                    const content = contentLines.join('\n');
                                                    
                                                    return (
                                                        <div key={paraIndex} className="mb-10">
                                                            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-2">{title}</h2>
                                                            <div className="space-y-3 ml-2">
                                                                {content.split('\n').map((line, lineIndex) => {
                                                                    const cleanLine = line.trim();
                                                                    if (!cleanLine) return null;
                                                                    
                                                                    // Handle asterisk bullet points
                                                                    if (cleanLine.startsWith('* ')) {
                                                                        return (
                                                                            <div key={lineIndex} className="flex items-start mb-2">
                                                                                <span className="text-gray-800 font-bold mr-3 mt-1">*</span>
                                                                                <span className="text-gray-700 leading-relaxed">{cleanLine.replace(/^\*\s*/, '')}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    
                                                                    // Regular text
                                                                    return (
                                                                        <p key={lineIndex} className="text-gray-700 mb-2">{cleanLine}</p>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Handle double-dash separators
                                                if (trimmedParagraph === '--') {
                                                    return (
                                                        <div key={paraIndex} className="my-10">
                                                            <div className="h-px bg-gray-300 w-3/4 mx-auto"></div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Regular paragraph
                                                return (
                                                    <div key={paraIndex} className="mb-6">
                                                        <p className="text-gray-700 leading-relaxed">{trimmedParagraph}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    {/* Report Footer */}
                                    <div className="bg-gray-50 border-t border-gray-300 px-12 py-6">
                                        <div className="text-center text-sm text-gray-500">
                                            <p>CONFIDENTIAL BUSINESS ANALYSIS • GENERATED BY SALONNEXT AI SYSTEM</p>
                                            <p className="mt-1">Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-12 h-full flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Failed</h3>
                            <p className="text-red-500 max-w-sm mb-6">{error}</p>
                            <button
                                onClick={() => generateAnalysis()}
                                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm p-12 h-full flex flex-col items-center justify-center text-center">
                            <Sparkles className="w-16 h-16 text-gray-200 mb-6" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Ready for Analysis</h3>
                            <p className="text-gray-500 max-w-sm mb-8">
                                Click the button below to generate a comprehensive business health report powered by AI.
                            </p>
                            <FormButton
                                onClick={() => generateAnalysis()}
                                loading={loading}
                                variant="purple"
                                className="px-8 py-3 text-lg"
                            >
                                Generate Full Report
                            </FormButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
