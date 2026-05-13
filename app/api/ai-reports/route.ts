import { getTenantModels } from "@/lib/tenantDb";
import { NextResponse, NextRequest } from "next/server";


import { startOfMonth, endOfMonth, subDays } from "date-fns";
import { checkPermissionWithSession } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rateLimiter";

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Settings, Invoice, Expense, Appointment, Customer, Product, Service, Staff, Payroll, Purchase } = await getTenantModels(tenantSlug);

    try {
        // [B14 FIX] Gunakan checkPermissionWithSession — 1 auth() call, bukan 2
        const { error: permissionError, session } = await checkPermissionWithSession(request, 'ai-reports', 'view');
        if (permissionError) return permissionError;

        // Rate Limiting (AI is expensive) — reuse session dari atas
        const ratelimit = checkRateLimit(session?.user?.id || 'anonymous', 60000 * 60, 10); // 10 requests per hour
        if (!ratelimit.allowed) {
            return NextResponse.json({
                success: false,
                error: `Rate limit exceeded. Please try again in ${Math.ceil((ratelimit.resetTime - Date.now()) / 60000)} minutes.`
            }, { status: 429 });
        }

        
        const { prompt, timeRange = '30d' } = await request.json();

        // 1. Fetch AI Settings
        const settings = await Settings.findOne({});
        if (!settings?.aiEnabled || !settings?.openaiApiKey) {
            return NextResponse.json({
                success: false,
                error: "AI is not enabled or API key is missing. Please check your settings."
            }, { status: 400 });
        }

        // 2. Aggregate Data for Context
        const end = new Date();
        const start = subDays(end, parseInt(timeRange) || 30);

        // Revenue & Profit Data
        const invoices = await Invoice.find({ date: { $gte: start, $lte: end } });
        const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
        const purchases = await Purchase.find({ date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } });

        const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalPurchases = purchases.reduce((sum, pur) => sum + pur.totalAmount, 0);

        // Service Stats
        const serviceStats: any = {};
        invoices.forEach(inv => {
            inv.items.forEach((item: any) => {
                if (item.itemModel === 'Service') {
                    if (!serviceStats[item.name]) serviceStats[item.name] = 0;
                    serviceStats[item.name] += item.quantity;
                }
            });
        });

        // Low Stock
        const lowStock = await Product.find({ stock: { $lte: 10 } }).limit(5).select('name stock');

        // Context for AI
        const context = {
            businessName: settings.storeName,
            timeRange: `${timeRange} days`,
            financials: {
                revenue: totalRevenue,
                expenses: totalExpenses,
                purchases: totalPurchases,
                netProfit: totalRevenue - totalExpenses - totalPurchases
            },
            popularServices: Object.entries(serviceStats).sort(([, a]: any, [, b]: any) => b - a).slice(0, 5),
            inventoryAlerts: lowStock.map(p => `${p.name}: ${p.stock} remaining`),
            overallStats: {
                totalInvoices: invoices.length,
                averageTicketSize: invoices.length > 0 ? totalRevenue / invoices.length : 0
            }
        };

        // 3. Call OpenAI
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.openaiApiKey}`
            },
            body: JSON.stringify({
                model: settings.openaiModel || "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are a business intelligence analyst preparing a structured report for ${settings.storeName}, a premium salon and wellness business. 
                        Structure your analysis using this format:
                        - Use numbered sections (1., 2., 3., etc.) for main topics
                        - Use double dash (--) as separator between sections
                        - Use asterisk (*) bullet points for each item under sections
                        - NO bold text, NO markdown headers (#), NO special formatting
                        - Keep all text plain and simple
                        
                        Example format:
                        1. Executive Summary
                        * Revenue growth: 18.5% YoY reaching $127,450
                        * Customer retention rate improved to 84%
                        * Service profitability increased by 12%
                        --
                        2. Key Metrics
                        * Monthly recurring revenue: $42,483
                        * Average transaction value: $89.20
                        * Client acquisition cost: $34.50
                        --
                        3. Financial Performance
                        * Service revenue: 68% ($86,666)
                        * Product sales: 22% ($28,039)
                        * Membership: 10% ($12,745)
                        
                        If responding to a specific question, use this same format with numbered sections, asterisk bullets, and double-dash separators.`
                    },
                    {
                        role: "user",
                        content: `User Question: ${prompt || "Give me a general business performance report and recommendations."}\n\nData Context:\n${JSON.stringify(context, null, 2)}`
                    }
                ],
                temperature: 0.7
            })
        });

        const aiData = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                error: aiData.error?.message || "Failed to communicate with OpenAI"
            }, { status: response.status });
        }

        return NextResponse.json({
            success: true,
            analysis: aiData.choices[0].message.content,
            usage: aiData.usage
        });

    } catch (error: any) {
        console.error("AI Report Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
