"use client";

import { useState, useEffect } from "react";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import TenantLink from '@/components/TenantLink';
import { ArrowLeft, Save, User as UserIcon } from "lucide-react";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";

export default function NewUserPage() {
    const router = useTenantRouter();
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<any[]>([]);
    const [error, setError] = useState("");

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState("");

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await fetch("/api/roles/user-list");
            const data = await res.json();
            if (data.success) {
                setRoles(data.data);
            }
        } catch (error) {
            console.error("Error fetching roles:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!selectedRole) {
            setError("Please select a role");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role: selectedRole
                }),
            });

            const data = await res.json();

            if (data.success) {
                router.push("/users");
            } else {
                setError(data.error || "Failed to create user");
            }
        } catch (error) {
            console.error("Error creating user:", error);
            setError("An error occurred while creating user");
        } finally {
            setLoading(false);
        }
    };

    const roleOptions = roles.map(r => ({
        value: r._id,
        label: r.name
    }));

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <TenantLink href="/users" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </TenantLink>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Create New User</h1>
                    <p className="text-gray-500">Add a new user and assign their role</p>
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
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            min="6"
                        />
                        <div className="text-xs text-blue-600 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 flex flex-col gap-1 shadow-sm -mt-2 mb-2">
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
                    <TenantLink
                        href="/users"
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </TenantLink>
                    <FormButton
                        type="submit"
                        loading={loading}
                    >
                        Create User
                    </FormButton>
                </div>
            </form>
        </div>
    );
}
