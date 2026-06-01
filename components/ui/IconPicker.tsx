"use client";

import React, { useState } from "react";
import { 
  Scissors, Droplet, Sparkles, Brush, Coffee, Heart, 
  Star, User, Users, Flame, Zap, Wind, Leaf, Smile, Gift, Check, Search, Flower2, Box
} from "lucide-react";

export const ICONS = [
  { id: "scissors", icon: Scissors, label: "Gunting" },
  { id: "droplet", icon: Droplet, label: "Air / Cuci" },
  { id: "sparkles", icon: Sparkles, label: "Kilau / Bersih" },
  { id: "brush", icon: Brush, label: "Kuas / Warna" },
  { id: "flower2", icon: Flower2, label: "Bunga / Treatment" },
  { id: "heart", icon: Heart, label: "Hati / Care" },
  { id: "star", icon: Star, label: "Bintang / Spesial" },
  { id: "user", icon: User, label: "Orang (1)" },
  { id: "users", icon: Users, label: "Orang (Group)" },
  { id: "flame", icon: Flame, label: "Api / Hot" },
  { id: "zap", icon: Zap, label: "Cepat / Instan" },
  { id: "wind", icon: Wind, label: "Angin / Blow" },
  { id: "leaf", icon: Leaf, label: "Natural" },
  { id: "smile", icon: Smile, label: "Senyum / Santai" },
  { id: "gift", icon: Gift, label: "Hadiah / Promo" },
  { id: "coffee", icon: Coffee, label: "Kopi / Menunggu" },
  { id: "box", icon: Box, label: "Paket / Kotak" },
];

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function IconPicker({ value, onChange, label = "Pilih Icon (Jika tidak ada gambar)" }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedIconDef = ICONS.find((i) => i.id === value) || ICONS[0];
  const SelectedIcon = value && selectedIconDef ? selectedIconDef.icon : null;

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors bg-white h-11 overflow-hidden"
      >
        <div className="flex items-center gap-2 truncate">
          {SelectedIcon ? (
            <>
              <div className="p-1.5 rounded-md bg-amber-50 border border-amber-100 text-amber-700 shrink-0">
                <SelectedIcon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 truncate">
                {selectedIconDef.label}
              </span>
            </>
          ) : (
            <>
              <div className="p-1.5 rounded-md bg-gray-50 border border-gray-100 text-gray-400 shrink-0">
                <div className="w-4 h-4 flex items-center justify-center text-xs">🚫</div>
              </div>
              <span className="text-sm font-medium text-gray-400 italic truncate">
                Pilih Icon...
              </span>
            </>
          )}
        </div>
        <div className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full mr-1 bg-gray-50 shrink-0">Ganti</div>
      </button>

      {isOpen && (
        <div className="absolute z-[100] top-full right-0 w-[340px] sm:w-[380px] mt-2 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-gray-200 p-2.5 flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1.5 max-h-[260px] overflow-y-auto p-0.5 custom-scrollbar">
            <button
              type="button"
              onClick={() => { onChange(""); setIsOpen(false); }}
              className={`flex flex-col items-center justify-start p-1.5 rounded-lg border-2 transition-all ${
                !value 
                  ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm" 
                  : "border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-500"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center mb-1 text-lg shrink-0">🚫</div>
              <span className="text-[10px] font-medium leading-tight text-center mt-1 line-clamp-2 w-full break-words">
                Tanpa Icon
              </span>
            </button>

            {ICONS.map((item) => {
              const isSelected = value === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onChange(item.id); setIsOpen(false); }}
                  className={`flex flex-col items-center justify-start p-1.5 rounded-lg border-2 transition-all group ${
                    isSelected 
                      ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm" 
                      : "border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-600"
                  }`}
                  title={item.label}
                >
                  <IconComp className={`w-5 h-5 mb-1 shrink-0 ${isSelected ? "text-amber-600" : "text-gray-500 group-hover:text-gray-800"}`} strokeWidth={isSelected ? 2.5 : 1.5} />
                  <span className={`text-[10px] font-medium leading-tight text-center mt-0.5 line-clamp-2 w-full break-words ${isSelected ? "text-amber-800" : "text-gray-500"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          
          <div className="flex justify-between items-center px-1 pt-1.5 border-t border-gray-100 mt-1">
            <p className="text-[10px] text-gray-400 italic">Muncul jika gambar kosong.</p>
            <button type="button" onClick={() => setIsOpen(false)} className="text-xs font-bold text-gray-500 hover:text-gray-800 px-3 py-1 bg-gray-100 rounded-md">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
