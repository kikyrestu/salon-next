"use client";

import { InputHTMLAttributes } from "react";
import SearchableSelect from "./SearchableSelect";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export default function FormInput({ label, error, className = "", ...props }: FormInputProps) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${error ? "border-red-500" : ""
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

interface TextAreaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
    rows?: number;
}

export function FormTextArea({ label, error, rows = 3, className = "", ...props }: TextAreaProps) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
                rows={rows}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${error ? "border-red-500" : ""
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    options: { value: string; label: string }[];
}

export function FormSelect({ label, error, options, className = "", onChange, value, placeholder, required }: any) {
    return (
        <SearchableSelect
            label={label}
            error={error}
            options={options}
            className={className}
            value={value as string}
            onChange={(val) => {
                if (onChange) {
                    onChange({ target: { value: val } } as any);
                }
            }}
            required={required as boolean}
            placeholder={placeholder || `Select ${label}`}
        />
    );
}

interface FileInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    onFileSelect?: (base64: string) => void;
}

export function FormFile({ label, error, onFileSelect, className = "", ...props }: FileInputProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onFileSelect) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onFileSelect(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type="file"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${error ? "border-red-500" : ""
                    } ${className}`}
                onChange={handleFileChange}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

export { default as FormButton } from "./FormButton";
