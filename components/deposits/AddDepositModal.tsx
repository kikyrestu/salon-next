"use client";

import { useState } from "react";
import { X, DollarSign } from "lucide-react";
import FormInput, { FormSelect } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";

interface AddDepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    transactionId: string;
    transactionType: 'sale' | 'purchase' | 'sale_return' | 'purchase_return';
    maxAmount: number;
}

export default function AddDepositModal({
    isOpen,
    onClose,
    onSuccess,
    transactionId,
    transactionType,
    maxAmount,
}: AddDepositModalProps) {
    const { settings } = useSettings();
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError("Please enter a valid amount");
            setLoading(false);
            return;
        }

        if (numAmount > maxAmount) {
            setError(`Amount cannot exceed remaining due (${settings.symbol}${maxAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })})`);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transactionType,
                    transaction: transactionId,
                    amount: numAmount,
                    paymentMethod,
                    notes,
                    // createdBy will be handled by the API/server
                }),
            });

            const data = await res.json();

            if (data.success) {
                onSuccess();
                onClose();
                setAmount("");
                setNotes("");
                setPaymentMethod("cash");
            } else {
                setError(data.error || "Failed to add deposit");
            }
        } catch (error) {
            console.error("Error adding deposit:", error);
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {transactionType.includes('return') ? 'Record Refund' : 'Add Payment'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                        <div className="text-sm text-blue-600 mb-1">Remaining Due</div>
                        <div className="text-2xl font-bold text-blue-900">
                            {settings.symbol}{maxAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    <FormInput
                        label="Amount"
                        type="number"
                        step="0.01"
                        required
                        value={amount}
                        onChange={(e: any) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        max={maxAmount.toString()}
                    />

                    <FormSelect
                        label="Payment Method"
                        required
                        value={paymentMethod}
                        onChange={(e: any) => setPaymentMethod(e.target.value)}
                        options={[
                            { value: "cash", label: "Cash" },
                            { value: "card", label: "Card" },
                            { value: "mobile", label: "Mobile Payment" },
                            { value: "credit", label: "Credit" }
                        ]}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent text-sm"
                            placeholder="Add any additional notes..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <DollarSign className="w-4 h-4" />
                            )}
                            {transactionType.includes('return') ? 'Record Refund' : 'Add Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
