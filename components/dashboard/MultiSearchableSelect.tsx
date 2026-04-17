"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";

interface Option {
    value: string;
    label: string;
}

interface MultiSearchableSelectProps {
    label?: string;
    value: string[];
    onChange: (value: string[]) => void;
    options: Option[];
    placeholder?: string;
    required?: boolean;
    error?: string;
    className?: string;
}

export default function MultiSearchableSelect({
    label,
    value,
    onChange,
    options,
    placeholder = "Select options",
    required,
    error,
    className = "",
}: MultiSearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOptions = options.filter((opt) => value.includes(opt.value));

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const toggleOption = (optionValue: string) => {
        if (value.includes(optionValue)) {
            onChange(value.filter((v) => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    };

    const removeOption = (optionValue: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(value.filter((v) => v !== optionValue));
    };

    return (
        <div className={`${label ? 'mb-4' : ''} ${className}`} ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <div className="relative">
                <div
                    className={`w-full px-3 py-1.5 border rounded-lg cursor-pointer flex flex-wrap items-center gap-2 bg-white min-h-[42px] ${error ? "border-red-500" : "border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
                        }`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {selectedOptions.length > 0 ? (
                        selectedOptions.map((opt) => (
                            <span
                                key={opt.value}
                                className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-blue-100"
                            >
                                {opt.label}
                                <X
                                    className="w-3 h-3 cursor-pointer hover:text-blue-900"
                                    onClick={(e) => removeOption(opt.value, e)}
                                />
                            </span>
                        ))
                    ) : (
                        <span className="text-gray-500 text-sm ml-1">{placeholder}</span>
                    )}
                    <div className="ml-auto">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                </div>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-gray-100 bg-gray-50">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No results found</div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const isSelected = value.includes(option.value);
                                    return (
                                        <div
                                            key={option.value}
                                            className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-blue-50 transition-colors ${isSelected ? "bg-blue-50 text-blue-900 font-semibold" : "text-gray-700"
                                                }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleOption(option.value);
                                            }}
                                        >
                                            {option.label}
                                            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
