"use client";

import { useState, useEffect } from "react";
import { Trash2, Calendar, CreditCard, DollarSign } from "lucide-react";

import { useSettings } from "@/components/providers/SettingsProvider";

interface Deposit {
    _id: string;
    depositNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    notes?: string;
    createdBy: {
        name: string;
        email: string;
    };
}

interface PaymentHistoryProps {
    transactionId: string;
    transactionType: 'sale' | 'purchase' | 'sale_return' | 'purchase_return';
    onUpdate: () => void;
}

export default function PaymentHistory({ transactionId, transactionType, onUpdate }: PaymentHistoryProps) {
    const { settings } = useSettings();
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchDeposits();
    }, [transactionId]);

    const fetchDeposits = async () => {
        try {
            const res = await fetch(`/api/deposits?transactionId=${transactionId}`);
            const data = await res.json();
            if (data.success) {
                setDeposits(data.data);
            }
        } catch (error) {
            console.error("Error fetching deposits:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this payment? This will update the payment status.")) return;

        setDeletingId(id);
        try {
            const res = await fetch(`/api/deposits/${id}`, {
                method: "DELETE"
            });
            const data = await res.json();

            if (data.success) {
                fetchDeposits();
                onUpdate(); // Trigger parent update to refresh totals
            } else {
                alert(data.error || "Failed to delete payment");
            }
        } catch (error) {
            console.error("Error deleting payment:", error);
            alert("Failed to delete payment");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return <div className="text-center py-4 text-gray-500">Loading payment history...</div>;
    }

    if (deposits.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-gray-500 text-sm">No payments recorded yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {deposits.map((deposit) => (
                <div key={deposit._id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{deposit.depositNumber}</span>
                                <span className="text-xs text-gray-500">• {new Date(deposit.paymentDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                                <span className="capitalize">{deposit.paymentMethod}</span>
                                {deposit.notes && <span className="text-gray-400">• {deposit.notes}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="font-bold text-gray-900">{settings.symbol}{deposit.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-gray-500">
                                by {deposit.createdBy?.name || 'Unknown'}
                            </div>
                        </div>
                        <button
                            onClick={() => handleDelete(deposit._id)}
                            disabled={deletingId === deposit._id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Payment"
                        >
                            {deletingId === deposit._id ? (
                                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
