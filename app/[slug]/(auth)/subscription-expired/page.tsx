'use client';

import "@/app/globals.css";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AlertTriangle, LogOut, MessageCircle } from 'lucide-react';

export default function SubscriptionExpiredPage() {
    const params = useParams();
    const slug = (params?.slug as string) || 'pusat';
    const [storeName, setStoreName] = useState('');

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
                if (data?.success && data?.data?.storeName) {
                    setStoreName(data.data.storeName);
                    document.title = `${data.data.storeName} - Langganan Berakhir`;
                }
            })
            .catch(() => {});
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>

                <h1 className="text-xl font-semibold text-slate-800 mb-2">
                    Langganan {storeName ? `"${storeName}"` : 'toko Anda'} sudah berakhir
                </h1>
                <p className="text-slate-500 text-sm mb-8">
                    Akses ke sistem kasir dan dashboard dinonaktifkan sementara. Perpanjang atau upgrade paket
                    langganan Anda untuk mengaktifkan kembali toko ini.
                </p>

                <div className="space-y-3">
                    <a
                        href={`/${slug}/settings/subscription`}
                        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition"
                    >
                        Perpanjang / Upgrade Paket
                    </a>

                    <button
                        onClick={() => signOut({ callbackUrl: `/${slug}/login` })}
                        className="w-full inline-flex items-center justify-center gap-2 text-slate-500 text-sm py-2 hover:text-slate-700 transition"
                    >
                        <LogOut className="w-4 h-4" />
                        Keluar
                    </button>
                </div>

                <p className="mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Butuh bantuan? Hubungi admin platform.
                </p>
            </div>
        </div>
    );
}
