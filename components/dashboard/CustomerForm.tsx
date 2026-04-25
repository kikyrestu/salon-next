"use client";

import { useState } from "react";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";

interface CustomerFormProps {
    initialData?: any;
    onSuccess: (customer: any) => void;
    onCancel: () => void;
}

export default function CustomerForm({ initialData, onSuccess, onCancel }: CustomerFormProps) {
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        address: initialData?.address || "",
        notes: initialData?.notes || "",
        status: initialData?.status || "active",
        birthday: initialData?.birthday ? new Date(initialData.birthday).toISOString().split("T")[0] : "",
        referredByCode: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError("");
        try {
            const url = initialData?._id ? `/api/customers/${initialData._id}` : "/api/customers";
            const res = await fetch(url, {
                method: initialData?._id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    birthday: formData.birthday ? new Date(formData.birthday) : undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onSuccess(data.data);
            } else {
                const errorMessage = data.details ? `Validation failed: ${data.details.join(', ')}` : (data.error || "Something went wrong");
                setFormError(errorMessage);
            }
        } catch (error) {
            console.error(error);
            setFormError("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="text-black">
            {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                    {formError}
                </div>
            )}
            <FormInput
                label="Customer Name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter customer name"
            />
            <FormInput
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@example.com"
            />
            <FormInput
                label="Phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="08..., 62..., atau +62... (otomatis dinormalisasi)"
            />
            <FormInput
                label="Tanggal Lahir"
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
            />
            {!initialData?._id && (
                <FormInput
                    label="Referral Code (Optional)"
                    value={formData.referredByCode}
                    onChange={(e) => setFormData({ ...formData, referredByCode: e.target.value.toUpperCase() })}
                    placeholder="Masukkan kode referral teman"
                />
            )}
            <FormInput
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
            />
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-sm resize-none"
                />
            </div>
            <FormSelect
                label="Status"
                required
                value={formData.status}
                onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" }
                ]}
            />
            <div className="flex flex-col-reverse sm:flex-row justify-end sm:space-x-3 gap-3 sm:gap-0 mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-bold transition-colors text-sm text-center"
                >
                    Cancel
                </button>
                <FormButton type="submit" loading={submitting} className="w-full sm:w-auto text-center justify-center">
                    {initialData?._id ? "Update Customer" : "Create Customer"}
                </FormButton>
            </div>
        </form>
    );
}
