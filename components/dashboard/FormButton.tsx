
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
        primary: "bg-blue-900 text-white hover:bg-blue-800 disabled:bg-blue-300",
        secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400",
        danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
        ghost: "bg-transparent hover:bg-gray-100 text-gray-600 disabled:text-gray-300",
        success: "bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300",
        purple: "bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-300",
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
