"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, User as UserIcon } from "lucide-react";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [roles, setRoles] = useState<any[]>([]);
    const [error, setError] = useState("");

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [rolesRes, userRes] = await Promise.all([
                    fetch("/api/roles"),
                    fetch(`/api/users/${id}`)
                ]);

                const rolesData = await rolesRes.json();
                const userData = await userRes.json();

                if (rolesData.success) setRoles(rolesData.data);

                if (userData.success) {
                    const user = userData.data;
                    setName(user.name || "");
                    setEmail(user.email);
                    setSelectedRole(user.role?._id || user.role || "");
                } else {
                    setError("User not found");
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                setError("Error loading details");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!selectedRole) {
            setError("Please select a role");
            return;
        }

        setSaving(true);

        try {
            const body: any = {
                name,
                email,
                role: selectedRole
            };

            // Only send password if it's not empty
            if (password) {
                body.password = password;
            }

            const res = await fetch(`/api/users/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (data.success) {
                router.push("/users");
            } else {
                setError(data.error || "Failed to update user");
            }
        } catch (error) {
            console.error("Error updating user:", error);
            setError("An error occurred while updating user");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading details...</div>;
    }

    const roleOptions = roles.map(r => ({
        value: r._id,
        label: r.name
    }));

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/users" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
                    <p className="text-gray-500">Update user details and role</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-blue-900" />
                        User Details
                    </h2>

                    <div className="space-y-4">
                        <FormInput
                            label="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. John Doe"
                            required
                        />

                        <FormInput
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            required
                        />

                        <FormInput
                            label="New Password (optional)"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Leave empty to keep current"
                            min="6"
                        />
                        <p className="text-xs text-gray-500 -mt-3">Only enter if you want to change the password.</p>
                        <div className="text-xs text-blue-600 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 flex flex-col gap-1 shadow-sm mt-1 mb-2">
                            <p className="font-bold flex items-center gap-2">
                                Password Requirements:
                            </p>
                            <p>One uppercase, one lowercase, one number, and one special character.</p>
                        </div>

                        <SearchableSelect
                            label="Role"
                            value={selectedRole}
                            onChange={setSelectedRole}
                            options={roleOptions}
                            placeholder="Select a role"
                            required
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <Link
                        href="/users"
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </Link>
                    <FormButton
                        type="submit"
                        loading={saving}
                    >
                        Save Changes
                    </FormButton>
                </div>
            </form>
        </div>
    );
}
