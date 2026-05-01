"use client";

import { useState, useEffect } from "react";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import { Shield, Mail, Lock, User, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function SetupForm() {
    const router = useTenantRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Double check setup status on mount
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/setup');
                const data = await res.json();
                if (data.success && !data.setupRequired) {
                    console.log("Setup already completed, redirecting to login...");
                    router.push('/login');
                }
            } catch (err) {
                console.error("Failed to check setup status:", err);
            }
        };
        checkStatus();
    }, [router]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validation
        if (!formData.email || !formData.password) {
            setError("Email and password are required");
            return;
        }

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
        if (!passwordRegex.test(formData.password)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password
                })
            });

            let data;
            try {
                const text = await res.text();
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error("Failed to parse JSON response:", text);
                    setError(`Server returned an invalid response (Status: ${res.status}). This often happens if the request is redirected or blocked.`);
                    return;
                }
            } catch (e) {
                console.error("Failed to read response body:", e);
                setError(`Failed to read response from server (Status: ${res.status})`);
                return;
            }

            if (data.success) {
                setSuccess(true);
                setTimeout(() => {
                    router.push("/login");
                }, 2000);
            } else {
                setError(data.error || "Setup failed");
            }
        } catch (error: any) {
            console.error("Setup error:", error);
            setError(error.message || "An error occurred during setup. Please check your connection.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to SalonNext</h1>
                    <p className="text-gray-600">Let&apos;s set up your administrator account</p>
                </div>

                {/* Setup Form */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    {success ? (
                        <div className="text-center py-8">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
                            <p className="text-gray-600 mb-4">Redirecting to login page...</p>
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            )}

                            {/* Name Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-400 rounded-lg text-black placeholder:text-gray-500 caret-black focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                            </div>

                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-400 rounded-lg text-black placeholder:text-gray-500 caret-black focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-400 rounded-lg text-black placeholder:text-gray-500 caret-black focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                                        placeholder="Minimum 8 characters"
                                        minLength={8}
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-600">
                                    Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character
                                </p>
                            </div>

                            {/* Confirm Password Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirm Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                                    <input
                                        type="password"
                                        required
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-400 rounded-lg text-black placeholder:text-gray-500 caret-black focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                                        placeholder="Re-enter your password"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5" />
                                        Complete Setup
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer Note */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500">
                        This account will have full administrative access to your system
                    </p>
                </div>
            </div>
        </div>
    );
}
