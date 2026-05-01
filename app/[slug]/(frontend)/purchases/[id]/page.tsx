
"use client";

import { useEffect, useState } from "react";
import { useParams,  } from "next/navigation";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import {
    ChevronLeft,
    Printer,
    Trash2,
    Calendar,
    User,
    MapPin,
    Phone,
    Mail,
    Package,
    FileText,
    CreditCard,
    ArrowLeft
} from "lucide-react";
import TenantLink from '@/components/TenantLink';
import { format } from "date-fns";
import { FormButton } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";

export default function PurchaseDetailsPage() {
    const { settings } = useSettings();
    const params = useParams();
    const router = useTenantRouter();
    const [purchase, setPurchase] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchPurchase();
    }, [params.id]);

    const fetchPurchase = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/${params.id}`);
            const data = await res.json();
            if (data.success) {
                setPurchase(data.data);
            } else {
                console.error(data.error);
                router.push('/purchases');
            }
        } catch (error) {
            console.error(error);
            router.push('/purchases');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this purchase? This will revert any stock adjustments made by this purchase.")) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/purchases/${params.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                router.push('/purchases');
            } else {
                alert(data.error || "Failed to delete purchase");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred while deleting");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 md:p-12 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="h-64 bg-white rounded-xl border border-gray-100 mb-6"></div>
                <div className="h-96 bg-white rounded-xl border border-gray-100"></div>
            </div>
        );
    }

    if (!purchase) return null;

    return (
        <div className="p-6 min-h-screen bg-gray-50 text-black max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-start gap-4 shrink-0 overflow-hidden pr-2">
                    <TenantLink
                        href="/purchases"
                        className="p-2 mt-1 sm:mt-0 hover:bg-white rounded-full transition-all text-gray-400 hover:text-blue-900 shadow-sm shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </TenantLink>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                            <span className="truncate">{purchase.purchaseNumber}</span>
                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border shrink-0 ${purchase.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' :
                                purchase.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                {purchase.status}
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">View detailed purchase history and inventory impact</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                    <button
                        onClick={() => window.print()}
                        className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all flex justify-center items-center gap-2 text-sm font-semibold text-gray-700 shadow-sm"
                    >
                        <Printer className="w-4 h-4 shrink-0" />
                        Print
                    </button>
                    <FormButton
                        onClick={handleDelete}
                        loading={deleting}
                        variant="danger"
                        className="w-full sm:w-auto text-center justify-center"
                        icon={<Trash2 className="w-4 h-4 shrink-0" />}
                    >
                        Delete
                    </FormButton>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Supplier Info */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <User className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Supplier Information</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Supplier Name</p>
                            <p className="font-bold text-gray-900">{purchase.supplier?.name || "N/A"}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Contact Person</p>
                                <p className="text-sm font-medium text-gray-700">{purchase.supplier?.contactPerson || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Phone</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Phone className="w-3 h-3 text-gray-400" />
                                    {purchase.supplier?.phone || "N/A"}
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Email</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Mail className="w-3 h-3 text-gray-400" />
                                    {purchase.supplier?.email || "N/A"}
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Address</p>
                                <div className="flex items-start gap-2 text-sm font-medium text-gray-700">
                                    <MapPin className="w-3 h-3 text-gray-400 mt-1" />
                                    {purchase.supplier?.address || "N/A"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Purchase Info */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Overview</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</p>
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {format(new Date(purchase.date), "MMMM dd, yyyy")}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Payment Status</p>
                                <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                    purchase.paymentStatus === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}>
                                    {purchase.paymentStatus?.replace('_', ' ') || 'Pending'}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Payment Method</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                    {purchase.paymentMethod || "N/A"}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Created By</p>
                                <p className="text-sm font-medium text-gray-700">{purchase.createdBy?.name || "System"}</p>
                            </div>
                        </div>

                        {purchase.notes && (
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 italic text-sm text-gray-600">
                                    "{purchase.notes}"
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Purchase Items</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full hidden md:table">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Product</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Quantity</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Unit Cost</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {purchase.items.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900">{item.product?.name || "Deleted Product"}</span>
                                            <span className="text-xs text-gray-400 font-medium tracking-wide">#{item.product?._id?.toString().slice(-6)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                            {item.quantity} units
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-700">
                                        {settings.symbol}{item.costPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {settings.symbol}{item.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Mobile Card View (Items) */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-100">
                        {purchase.items.map((item: any, idx: number) => (
                            <div key={idx} className="p-4 flex flex-col gap-3">
                                <div>
                                    <span className="font-bold text-gray-900 block">{item.product?.name || "Deleted Product"}</span>
                                    <span className="text-xs text-gray-400 font-medium tracking-wide">#{item.product?._id?.toString().slice(-6)}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 border border-gray-100 rounded-xl p-3">
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Quantity</p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                            {item.quantity} units
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Unit Cost</p>
                                        <span className="font-medium text-gray-700">{settings.symbol}{item.costPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center border-t border-gray-50 pt-2 mt-1">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total</span>
                                    <span className="font-bold text-gray-900 text-base">{settings.symbol}{item.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Summary Table */}
                <div className="bg-gray-50/50 p-6 flex justify-end">
                    <div className="w-full max-w-xs space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-500">Subtotal</span>
                            <span className="font-bold text-gray-900">{settings.symbol}{purchase.subtotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                        {purchase.tax > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-medium text-gray-500">Tax</span>
                                <span className="font-bold text-gray-900">{settings.symbol}{purchase.tax.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                        )}
                        {purchase.shipping > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-medium text-gray-500">Shipping</span>
                                <span className="font-bold text-gray-900">{settings.symbol}{purchase.shipping.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                        )}
                        {purchase.discount > 0 && (
                            <div className="flex justify-between items-center text-sm text-red-600">
                                <span className="font-medium">Discount</span>
                                <span className="font-bold">-{settings.symbol}{purchase.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                        )}
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-lg font-black text-gray-900 uppercase tracking-widest">Total</span>
                            <span className="text-2xl font-black text-blue-900">{settings.symbol}{purchase.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="pt-2 flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-400 uppercase tracking-wider">Paid Amount</span>
                            <span className="font-bold text-green-600">{settings.symbol}{purchase.paidAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body { background: white; }
                    .no-print, button, Link, a[href="/purchases"] { display: none !important; }
                    .max-w-5xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .shadow-sm, .shadow-xl { shadow: none !important; box-shadow: none !important; }
                    .border { border: 1px solid #eee !important; }
                    .bg-gray-50 { background: white !important; }
                }
            `}</style>
        </div>
    );
}
