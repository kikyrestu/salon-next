"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    label?: string;
}

export default function ImageUpload({ value, onChange, label = "Image" }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);

        // Compress image client-side before upload
        let compressedFile = file;
        try {
            compressedFile = await compressImage(file, 0.1); // compress to under 0.1 MB
        } catch (error) {
            console.error("Compression failed, using original file", error);
        }

        const formData = new FormData();
        formData.append("file", compressedFile);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                onChange(data.url);
            } else {
                alert(data.error || "Upload failed");
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const compressImage = (file: File, maxSizeMB: number): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new window.Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 1000;
                    const MAX_HEIGHT = 1000;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) return resolve(file);
                    ctx.drawImage(img, 0, 0, width, height);

                    let quality = 0.8;
                    const attemptCompress = () => {
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                resolve(file);
                                return;
                            }
                            if (blob.size / 1024 / 1024 > maxSizeMB && quality > 0.1) {
                                quality -= 0.1;
                                attemptCompress();
                            } else {
                                const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                                const newFile = new File([blob], newFileName, {
                                    type: "image/jpeg",
                                    lastModified: Date.now(),
                                });
                                resolve(newFile);
                            }
                        }, "image/jpeg", quality);
                    };
                    attemptCompress();
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    return (
        <div className="mb-4">
            <label className="block text-xs lg:text-sm font-semibold text-gray-700 mb-1 lg:mb-2">{label}</label>
            <div className="flex items-center gap-4">
                {value ? (
                    <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-lg overflow-hidden border border-gray-200">
                        <Image src={value} alt="Uploaded" fill className="object-cover" />
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ) : (
                    <label className="w-20 h-20 lg:w-24 lg:h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors">
                        {uploading ? (
                            <span className="text-xs text-gray-500">Uploading...</span>
                        ) : (
                            <>
                                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                                <span className="text-[10px] text-gray-500">Upload</span>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                    </label>
                )}
            </div>
        </div>
    );
}