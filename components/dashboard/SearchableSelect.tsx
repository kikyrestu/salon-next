"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Option {
    value: string;
    label: string;
    showGreenIndicator?: boolean;
}

interface SearchableSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    required?: boolean;
    error?: string;
    className?: string;
    controlClassName?: string;
}

export default function SearchableSelect({
    label,
    value,
    onChange,
    options,
    placeholder = "Select option",
    required,
    error,
    className = "",
    controlClassName = "",
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

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
                    className={`w-full px-4 py-2 text-sm border-2 rounded-lg cursor-pointer flex items-center justify-between bg-white ${error ? "border-red-500" : "border-gray-400 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600"
                        } ${controlClassName
                        }`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className={`block truncate ${!selectedOption ? "text-gray-500" : "text-gray-900 font-medium"}`}>
                        {selectedOption ? (
                            <span className="inline-flex items-center gap-2">
                                {selectedOption.showGreenIndicator && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" aria-label="Has active package" />
                                )}
                                <span className="truncate">{selectedOption.label}</span>
                            </span>
                        ) : (
                            placeholder
                        )}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>

                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-400 rounded-lg shadow-xl max-h-60 overflow-auto">
                        <div className="p-2 sticky top-0 bg-white border-b-2 border-gray-300">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                                <input
                                    type="text"
                                    className="w-full pl-8 pr-4 py-1.5 text-sm border-2 border-gray-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-2 text-sm text-gray-600 font-medium">No results found</div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <div
                                        key={option.value}
                                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-100 ${option.value === value ? "bg-blue-600 text-white font-semibold" : "text-gray-900"
                                            }`}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            {option.showGreenIndicator && (
                                                <span className="inline-block w-2 h-2 rounded-full bg-green-400 shrink-0" aria-label="Has active package" />
                                            )}
                                            <span>{option.label}</span>
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
