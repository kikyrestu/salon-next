'use client';

import "@/app/globals.css";

import { useState, useEffect, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [storeName, setStoreName] = useState('SalonNext');
    const [logo, setLogo] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success && data.data) {
                if (data.data.storeName) {
                    setStoreName(data.data.storeName);
                    document.title = `${data.data.storeName} - Login`;
                }
                if (data.data.logoUrl) {
                    setLogo(data.data.logoUrl);
                }
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
                setLoading(false);
                return;
            }

            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const fillDemoCredentials = () => {
        setEmail('admin@example.com');
        setPassword('Admin123!');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]"></div>
            </div>

            <div className="w-full max-w-sm relative z-10">
                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/10">
                    {/* Logo & Title */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center mb-4">
                            {logo ? (
                                <img src={logo} alt={storeName} className="h-20 w-auto object-contain drop-shadow-lg" />
                            ) : (
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center">
                                    <Sparkles className="w-7 h-7 text-white" />
                                </div>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-white uppercase tracking-tight">
                            {storeName}
                        </h1>
                        <p className="text-blue-200/60 text-sm mt-1">Sign in to continue</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-blue-100 mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-3 py-2.5 bg-white/10 border-2 border-white/30 rounded-lg text-sm text-white placeholder-blue-200/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-blue-100 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-3 py-2.5 bg-white/10 border-2 border-white/30 rounded-lg text-sm text-white placeholder-blue-200/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center">
                            <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer hover:text-white transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-2 border-white/40 bg-white/10 text-blue-500 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer"
                                />
                                Remember me
                            </label>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium py-2.5 px-4 rounded-lg text-sm hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>



                    {/* Footer */}
                    <p className="text-center text-blue-400/30 text-xs mt-6 pt-4 border-t border-white/5">
                        © {new Date().getFullYear()} {storeName}
                    </p>
                </div>
            </div>
        </div>
    );
}
