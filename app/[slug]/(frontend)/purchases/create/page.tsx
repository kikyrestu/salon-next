
"use client";


import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Save, Calculator, X } from "lucide-react";
import TenantLink from '@/components/TenantLink';
import { useTenantRouter } from "@/hooks/useTenantRouter";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import { useSettings } from "@/components/providers/SettingsProvider";

interface Product {
    _id: string;
    name: string;
    costPrice: number;
    stock: number;
}

interface Supplier {
    _id: string;
    name: string;
}

export default function CreatePurchasePage() {
  const params = useParams();
  const slug = params.slug as string;
    const { settings } = useSettings();
    const router = useTenantRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        supplier: "",
        date: new Date().toISOString().split('T')[0],
        status: "received",
        items: [] as any[],
        tax: 0,
        shipping: 0,
        discount: 0,
        paidAmount: 0,
        paymentStatus: "paid",
        paymentMethod: "Cash",
        notes: ""
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [supRes, prodRes] = await Promise.all([
                fetch('/api/suppliers/purchase-list', { headers: { "x-store-slug": slug } }),
                fetch('/api/products/purchase-list')
            ]);
            const supData = await supRes.json();
            const prodData = await prodRes.json();

            if (supData.success) setSuppliers(supData.data);
            if (prodData.success) setProducts(prodData.data);
        } catch (error) {
            console.error(error);
        }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { product: "", quantity: 1, costPrice: 0, total: 0 }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === "product") {
            const product = products.find(p => p._id === value);
            if (product) {
                newItems[index].costPrice = product.costPrice;
            }
        }

        // Recalculate total
        newItems[index].total = newItems[index].quantity * newItems[index].costPrice;
        setFormData({ ...formData, items: newItems });
    };

    const calculateSubtotal = () => {
        return formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        return subtotal + formData.tax + formData.shipping - formData.discount;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplier) return alert("Please select a supplier");
        if (formData.items.length === 0) return alert("Please add at least one item");

        setLoading(true);
        try {
            const payload = {
                ...formData,
                subtotal: calculateSubtotal(),
                totalAmount: calculateTotal(),
                items: formData.items.map(item => ({
                    ...item,
                    product: item.product,
                    quantity: Number(item.quantity),
                    costPrice: Number(item.costPrice),
                    total: Number(item.total)
                }))
            };

            const res = await fetch('/api/purchases', {
                method: 'POST',
                headers: { "x-store-slug": slug, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                router.push('/purchases');
            } else {
                alert(data.error || "Failed to create purchase");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 text-black">
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0 overflow-hidden pr-2">
                        <TenantLink href="/purchases" className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                            <ArrowLeft className="w-5 h-5 text-gray-500" />
                        </TenantLink>
                        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Create Purchase Order</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <FormButton
                            onClick={handleSubmit}
                            loading={loading}
                        >
                            Save Purchase
                        </FormButton>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* General Info */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-900 rounded-full"></span>
                            General Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <SearchableSelect
                                label="Supplier"
                                required
                                placeholder="Choose Supplier"
                                value={formData.supplier}
                                onChange={(value) => setFormData({ ...formData, supplier: value })}
                                options={suppliers.map(s => ({ value: s._id, label: s.name }))}
                            />
                            <FormInput
                                label="Date"
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                            <FormSelect
                                label="Status"
                                value={formData.status}
                                onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                                options={[
                                    { value: "received", label: "Received (Updates Stock)" },
                                    { value: "pending", label: "Pending" },
                                    { value: "cancelled", label: "Cancelled" }
                                ]}
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-900 rounded-full"></span>
                                Order Items
                            </h2>
                            <button
                                type="button"
                                onClick={addItem}
                                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-2 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Quantity</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Unit Cost</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Total</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {formData.items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                                                No items added. Click "Add Item" to start.
                                            </td>
                                        </tr>
                                    ) : (
                                        formData.items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="p-3">
                                                    <SearchableSelect
                                                        value={item.product}
                                                        onChange={(value) => updateItem(index, "product", value)}
                                                        placeholder="Search Product..."
                                                        options={products.map(p => ({
                                                            value: p._id,
                                                            label: `${p.name} (${settings.symbol}${p.costPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })})`
                                                        }))}
                                                        className="mb-0"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value))}
                                                        className="w-full p-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-900/20 outline-none"
                                                        required
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.costPrice}
                                                        onChange={(e) => updateItem(index, "costPrice", parseFloat(e.target.value))}
                                                        className="w-full p-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-900/20 outline-none"
                                                        required
                                                    />
                                                </td>
                                                <td className="p-3 text-right font-semibold text-gray-900">
                                                    {settings.symbol}{(item.total || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile Card View (Items) */}
                            <div className="md:hidden flex flex-col gap-4 mt-2">
                                {formData.items.length === 0 ? (
                                    <div className="py-8 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                                        No items added. Click "Add Item" to start.
                                    </div>
                                ) : (
                                    formData.items.map((item, index) => (
                                        <div key={index} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 space-y-3 relative mt-2">
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors shadow-sm"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                            
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Product</label>
                                                <SearchableSelect
                                                    value={item.product}
                                                    onChange={(value) => updateItem(index, "product", value)}
                                                    placeholder="Search Product..."
                                                    options={products.map(p => ({
                                                        value: p._id,
                                                        label: `${p.name} (${settings.symbol}${p.costPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })})`
                                                    }))}
                                                    className="mb-0 bg-white"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Qty</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value))}
                                                        className="w-full p-2 border border-gray-200 bg-white rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-900/20 outline-none"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Unit Cost</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.costPrice}
                                                        onChange={(e) => updateItem(index, "costPrice", parseFloat(e.target.value))}
                                                        className="w-full p-2 border border-gray-200 bg-white rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-900/20 outline-none"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-gray-200 flex justify-between items-center mt-2">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</span>
                                                <span className="font-bold text-gray-900 text-base">{settings.symbol}{(item.total || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment & Totals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-900 rounded-full"></span>
                                Payment Details
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormInput
                                        label="Paid Amount"
                                        type="number"
                                        value={formData.paidAmount}
                                        onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) })}
                                    />
                                    <FormSelect
                                        label="Payment Status"
                                        value={formData.paymentStatus}
                                        onChange={(e: any) => setFormData({ ...formData, paymentStatus: e.target.value })}
                                        options={[
                                            { value: "paid", label: "Paid" },
                                            { value: "pending", label: "Pending" },
                                            { value: "partially_paid", label: "Partially Paid" }
                                        ]}
                                    />
                                </div>
                                <FormInput
                                    label="Payment Method"
                                    value={formData.paymentMethod}
                                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                    placeholder="e.g. Bank Transfer, Cash"
                                />
                                <FormInput
                                    label="Notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Internal notes..."
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm h-fit">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-900 rounded-full"></span>
                                Order Summary
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span>{settings.symbol}{calculateSubtotal().toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600 gap-4">
                                    <span>Tax</span>
                                    <input
                                        type="number"
                                        className="w-24 p-1 text-right border border-gray-200 rounded text-xs"
                                        value={formData.tax}
                                        onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600 gap-4">
                                    <span>Shipping</span>
                                    <input
                                        type="number"
                                        className="w-24 p-1 text-right border border-gray-200 rounded text-xs"
                                        value={formData.shipping}
                                        onChange={(e) => setFormData({ ...formData, shipping: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-sm text-green-600 gap-4">
                                    <span>Discount</span>
                                    <input
                                        type="number"
                                        className="w-24 p-1 text-right border border-gray-200 rounded text-xs"
                                        value={formData.discount}
                                        onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="h-px bg-gray-100 my-2" />
                                <div className="flex justify-between text-lg font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>{settings.symbol}{calculateTotal().toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
