
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Settings {
    storeName: string;
    currency: string;
    timezone: string;
    taxRate: number;
    logoUrl: string;
    symbol: string;
}

interface SettingsContextType {
    settings: Settings;
    loading: boolean;
    refreshSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
    storeName: 'SalonNext',
    currency: 'USD',
    timezone: 'UTC',
    taxRate: 0,
    logoUrl: '',
    symbol: '$'
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success) {
                // Get currency symbol from our utility
                const { getCurrencySymbol } = await import('@/lib/currency');
                const symbol = getCurrencySymbol(data.data.currency || 'USD');

                setSettings({
                    storeName: data.data.storeName || 'SalonNext',
                    currency: data.data.currency || 'USD',
                    timezone: data.data.timezone || 'UTC',
                    taxRate: data.data.taxRate || 0,
                    logoUrl: data.data.logoUrl || '',
                    symbol: symbol
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
