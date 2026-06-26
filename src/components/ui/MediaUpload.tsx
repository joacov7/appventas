"use client";

import { useState, useRef } from "react";
import { Upload, X, ImageIcon, Video } from "lucide-react";
import Image from "next/image";

interface MediaUploadProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

export function MediaUpload({ urls, onChange }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFiles(files: FileList) {
    if (!cloudName || !preset) {
      alert("Cloudinary no configurado. Agregá NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET en Vercel.");
      return;
    }
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", preset);
      const resourceType = file.type.startsWith("video") ? "video" : "image";
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (data.secure_url) newUrls.push(data.secure_url);
    }
    onChange([...urls, ...newUrls]);
    setUploading(false);
  }

  function remove(url: string) {
    onChange(urls.filter((u) => u !== url));
  }

  function isVideo(url: string) {
    return /\.(mp4|mov|webm|avi)/.test(url) || url.includes("/video/");
  }

  return (
    <div className="space-y-3">
      {/* Previews */}
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
              {isVideo(url) ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <Video size={24} className="text-gray-500" />
                  <span className="text-xs text-gray-500 ml-1">Video</span>
                </div>
              ) : (
                <Image src={url} alt="" fill className="object-cover" sizes="120px" />
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} className="text-gray-700" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <span className="text-sm">Subiendo...</span>
        ) : (
          <>
            <div className="flex gap-2">
              <ImageIcon size={20} />
              <Video size={20} />
            </div>
            <span className="text-sm">Subir imágenes o videos</span>
            <span className="text-xs">JPG, PNG, MP4, MOV</span>
          </>
        )}
      </button>

      {/* También permitir URL manual */}
      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer hover:text-gray-600">Agregar por URL</summary>
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            placeholder="https://..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) { onChange([...urls, val]); (e.target as HTMLInputElement).value = ""; }
              }
            }}
          />
          <span className="text-gray-400 self-center">↵ Enter</span>
        </div>
      </details>
    </div>
  );
}
