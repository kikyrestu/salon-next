"use client";

import { useState, useEffect } from "react";
import { useParams,  } from "next/navigation";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import { format } from "date-fns";
import { Printer, ArrowLeft, Scissors } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { getCurrencySymbol } from "@/lib/currency";

export default function PrintInvoicePage() {
    const { id } = useParams();
    const router = useTenantRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [invRes, settingsRes, depositsRes] = await Promise.all([
                    fetch(`/api/invoices/${id}`),
                    fetch("/api/settings"),
                    fetch(`/api/deposits?invoiceId=${id}`)
                ]);
                const invData = await invRes.json();
                const settingsData = await settingsRes.json();
                const depositsData = await depositsRes.json();

                if (invData.success) setInvoice(invData.data);
                if (settingsData.success) setSettings(settingsData.data);
                if (depositsData.success) setDeposits(depositsData.data);
            } catch (error) {
                console.error("Error fetching print data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">Loading receipt...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

    const currencySymbol = getCurrencySymbol(settings?.currency || 'IDR');

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white text-black">
            {/* Header / Controls */}
            <div className="max-w-[400px] mx-auto flex justify-between items-center mb-6 print:hidden">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <FormButton
                    onClick={handlePrint}
                    icon={<Printer className="w-4 h-4" />}
                >
                    Print Receipt
                </FormButton>
            </div>

            {/* Thermal Receipt Content */}
            <div className="max-w-[380px] mx-auto bg-white p-6 shadow-xl print:shadow-none print:w-full font-mono text-sm border-t-8 border-blue-900 print:border-t-0">
                {/* Store Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold uppercase tracking-tighter mb-1">{settings?.storeName || "SALON POS"}</h1>
                    <p className="text-[11px] text-gray-500 uppercase">{settings?.address || "123 Beauty Lane, Salon City"}</p>
                    <p className="text-[11px] text-gray-500">TEL: {settings?.phone || "000-000-0000"}</p>
                    <div className="mt-4 border-y border-dashed border-gray-300 py-2">
                        <p className="font-bold text-lg">TAX RECEIPT</p>
                    </div>
                </div>

                {/* Info Block */}
                <div className="space-y-1 mb-6 text-[12px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Receipt No:</span>
                        <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span>{format(new Date(invoice.date), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Customer:</span>
                        <span className="font-bold">{invoice.customer?.name || "Walk-in"}</span>
                    </div>
                    
                    {invoice.referralCode && (
                        <div className="flex justify-between items-start text-xs border-dashed border border-gray-300 p-1 mt-1 bg-gray-50/50">
                            <span className="text-gray-500">Referred By:</span>
                            <span className="font-bold text-right ml-2 break-all">{invoice.customer?.referredBy?.name || "Member VIP"}</span>
                        </div>
                    )}
                    {invoice.appointment && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="text-indigo-600 font-bold uppercase">Appointment</span>
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <table className="w-full mb-8 border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-900 text-xs text-left text-gray-800 uppercase tracking-wider">
                            <th className="py-3 font-bold" style={{ width: '45%' }}>Item Description</th>
                            <th className="py-3 font-bold text-center" style={{ width: '10%' }}>Qty</th>
                            <th className="py-3 font-bold text-right pr-2" style={{ width: '22%' }}>Unit Price</th>
                            <th className="py-3 font-bold text-right" style={{ width: '23%' }}>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {invoice.items.map((item: any, idx: number) => {
                            // Bundle items: show individual service price as 0
                            const isBundleChild = item.name && item.name.includes('(Bundle:');
                            const displayPrice = isBundleChild ? 0 : item.price;
                            const displayTotal = isBundleChild ? 0 : item.total;
                            return (
                            <tr key={idx} className="text-sm">
                                <td className="py-4 align-top">
                                    <p className="font-bold text-gray-900">{item.name}</p>
                                    <div className="mt-1 space-y-0.5">
                                        {item.itemModel === 'Service' && (
                                            <span className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold uppercase rounded">Service</span>
                                        )}
                                        {item.itemModel === 'Product' && (
                                            <span className="inline-block px-1.5 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold uppercase rounded">Product</span>
                                        )}
                                        {item.discount > 0 && (
                                            <p className="text-[10px] text-red-600 font-medium italic">
                                                * Includes discount of -{currencySymbol}{item.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                            </p>
                                        )}
                                    </div>
                                </td>
                                <td className="py-4 text-center align-top font-medium">{item.quantity}</td>
                                <td className="py-4 text-right align-top pr-2">{isBundleChild ? '-' : `${currencySymbol}${displayPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                                <td className="py-4 text-right align-top font-black text-gray-900">{isBundleChild ? '-' : `${currencySymbol}${displayTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Package Usage Section */}
                {invoice.packageUsage && invoice.packageUsage.length > 0 && (
                    <div className="border-t border-dashed border-gray-400 py-3 mt-4 space-y-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Package Usage Detail</p>
                        {invoice.packageUsage.map((pkg: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded text-[11px] text-gray-700">
                                <div className="flex justify-between font-bold mb-0.5 text-[12px] text-gray-900">
                                    <span>{pkg.itemName}</span>
                                    <span className="text-blue-700 bg-blue-100 px-1 rounded">{pkg.usedQuantity}x Dipakai</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>Paket: {pkg.packageName}</span>
                                    <span>Sisa Kuota: <strong className="text-emerald-700 font-bold bg-emerald-100 px-1 rounded">{pkg.remainingQuota}</strong></span>
                                </div>
                                {pkg.expiryDate && (
                                    <div className="text-[9px] text-gray-400 mt-1">
                                        Berlaku s/d: {new Date(pkg.expiryDate).toLocaleDateString('id-ID')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Summary Section */}
                <div className="border-t-2 border-gray-900 pt-6 space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                        <span className="font-medium">Gross Subtotal</span>
                        <span className="font-bold">{currencySymbol}{invoice.subtotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex flex-col text-red-600">
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Total Discount</span>
                                <span className="font-bold">-{currencySymbol}{invoice.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                            {invoice.discountBreakdown && (
                                <div className="ml-2 mt-1 space-y-0.5 border-l border-red-200 pl-2">
                                    {invoice.discountBreakdown.manual > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Manual ({invoice.discountBreakdown.manualReason || 'Discount'})</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.manual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                    {invoice.discountBreakdown.loyalty > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Loyalty Points</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.loyalty.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                    {invoice.discountBreakdown.referral > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Referral Promo</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.referral.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                    {invoice.discountBreakdown.voucher > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Voucher</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.voucher.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {settings?.showTaxAndTaxableAmountOnReceipt !== false && (
                        <>
                            <div className="flex justify-between items-center text-gray-800 border-t border-gray-100 pt-2">
                                <span className="font-medium text-[12px] uppercase tracking-tight">Taxable Amount</span>
                                <span className="font-bold">{currencySymbol}{(invoice.subtotal - invoice.discount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-700">
                                <span className="font-medium">GST / Tax ({(invoice.subtotal - invoice.discount) > 0 ? ((invoice.tax / (invoice.subtotal - invoice.discount)) * 100).toFixed(0) : 0}%)</span>
                                <span className="font-bold">{currencySymbol}{invoice.tax.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                        </>
                    )}
                    {invoice.tips > 0 && (
                        <div className="flex justify-between text-indigo-600 font-bold border-t border-indigo-100 pt-1">
                            <span>Tips</span>
                            <span>{currencySymbol}{invoice.tips.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-4 border-t-2 border-double border-gray-900 text-xl font-black uppercase text-gray-900">
                        <span>Grand Total</span>
                        <span>{currencySymbol}{invoice.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>

                    {/* Staff Recognition — conditional via settings */}
                    {settings?.showStaffOnReceipt !== false && invoice.staffAssignments && invoice.staffAssignments.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="mb-3 uppercase font-black tracking-widest text-[9px] text-gray-400 border-l-2 border-gray-200 pl-2">Served By</p>
                            <div className="space-y-1.5 px-1 py-1">
                                {invoice.staffAssignments.map((a: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-[11px] bg-gray-50/50 p-2 rounded border border-gray-100/50">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                                            <span className="font-bold text-gray-800 uppercase tracking-tight">{a.staff?.name || 'Staff Member'}</span>
                                        </div>
                                        {a.tip > 0 && (
                                            <span className="px-2 text-indigo-600 font-black italic underline decoration-indigo-200 underline-offset-2">Tip: {currencySymbol}{a.tip.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between text-green-700 font-bold">
                        <span>Net Paid</span>
                        <span>{currencySymbol}{invoice.amountPaid.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {invoice.totalAmount - invoice.amountPaid > 0 && (
                        <div className="flex justify-between text-red-600 font-bold border-t border-dashed border-red-100 mt-1 pt-1">
                            <span>Balance Due</span>
                            <span>{currencySymbol}{(invoice.totalAmount - invoice.amountPaid).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                </div>

                {/* Payment History */}
                {deposits.length > 0 && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment History</p>
                        <div className="space-y-2">
                            {deposits.map((dep, idx) => (
                                <div key={idx} className="flex justify-between text-[11px]">
                                    <div className="text-gray-500">
                                        <span>{format(new Date(dep.date), "dd/MM/yy HH:mm")}</span>
                                        <span className="mx-2">•</span>
                                        <span className="uppercase">{dep.paymentMethod}</span>
                                    </div>
                                    <span className="font-bold">{currencySymbol}{dep.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Section */}
                <div className="mt-10 text-center space-y-4">
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Payment Method</p>
                        {invoice.paymentMethods && invoice.paymentMethods.length > 1 ? (
                            <div className="flex flex-col items-center gap-1">
                                {invoice.paymentMethods.map((pm: any, i: number) => (
                                    <p key={i} className="font-bold text-sm bg-gray-100 px-3 py-1 rounded-full uppercase">
                                        {pm.method}: {currencySymbol}{pm.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    </p>
                                ))}
                            </div>
                        ) : (
                            <p className="font-bold text-sm bg-gray-100 px-3 py-1 rounded-full uppercase">{invoice.paymentMethod || 'Cash'}</p>
                        )}
                    </div>

                    <div className="pt-6 relative">
                        <div className="absolute top-0 left-0 w-full border-t border-dashed border-gray-300"></div>
                        <Scissors className="w-4 h-4 text-gray-300 absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-1" />
                        <p className="text-[11px] font-bold text-gray-900 mt-4 leading-relaxed">
                            THANK YOU FOR CHOOSING {settings?.storeName || "US"}!<br />
                            PLEASE VISIT AGAIN.
                        </p>
                        <p className="text-[9px] text-gray-400 mt-2 italic">Prices inclusive of taxes where applicable</p>
                    </div>

                    <div className="pt-4 flex justify-center opacity-20">
                        {/* Placeholder for barcode-like aesthetic */}
                        <div className="flex gap-px h-8 bg-gray-900 w-full max-w-[200px]"></div>
                    </div>
                    <p className="text-[8px] text-gray-300 tracking-[4px] uppercase">{invoice.invoiceNumber}</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    @page {
                        margin: 0;
                        size: 80mm auto;
                    }
                }
            `}</style>
        </div>
    );
}
