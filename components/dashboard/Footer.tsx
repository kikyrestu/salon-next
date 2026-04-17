"use client";

import { useState, useEffect } from "react";

export default function Footer() {
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            if (data.success) {
                setSettings(data.data);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    return (
        <footer className="py-4 px-6 bg-white border-t border-gray-200">
            <div className="flex flex-col items-center justify-center text-sm text-gray-500 space-y-1">
                {settings?.receiptFooter && (
                    <p className="text-xs">
                        {settings.receiptFooter}
                    </p>
                )}
            </div>
        </footer>
    );
}
