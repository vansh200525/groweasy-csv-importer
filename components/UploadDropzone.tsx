"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onFileSelected: (file: File) => void;
  error?: string | null;
}

export default function UploadDropzone({ onFileSelected, error }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.toLowerCase().endsWith(".csv")) {
        onFileSelected(file); // let parent validate & show a proper error
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          isDragging
            ? "scale-[1.01] border-brand-500 bg-brand-50 dark:bg-brand-900/20"
            : "border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500 dark:hover:bg-brand-900/10"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Drop your CSV file here
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">or click to browse files</p>
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Any CSV layout works — Facebook Ads, Google Ads, Excel exports, CRM
          exports, and more.
        </p>
      </div>
      {error && (
        <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
