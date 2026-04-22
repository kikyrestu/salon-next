
"use client";

import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface FormButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    children: ReactNode;
    variant?: "primary" | "secondary" | "danger" | "ghost" | "success" | "purple";
    icon?: ReactNode;
}

export default function FormButton({
    loading,
    children,
    variant = "primary",
    icon,
    className = "",
    disabled,
    ...props
}: FormButtonProps) {
    const variants = {
        primary: "bg-blue-900 text-white hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed",
        secondary: "bg-white border-2 border-gray-400 text-gray-900 hover:bg-gray-50 hover:border-gray-500 disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed",
        danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed",
        ghost: "bg-transparent hover:bg-gray-200 text-gray-900 border border-gray-300 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed",
        success: "bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed",
        purple: "bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed",
    };

    return (
        <button
            {...props}
            disabled={loading || disabled}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all font-semibold shadow-sm ${variants[variant]} ${className}`}
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin text-inherit opacity-80" />
                    <span>Processing...</span>
                </>
            ) : (
                <>
                    {icon && <span className="flex-shrink-0">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
}
