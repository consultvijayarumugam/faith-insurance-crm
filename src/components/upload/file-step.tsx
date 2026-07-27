"use client";

import * as React from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function FileStep({
  onFileSelected,
  parsing,
  error,
}: {
  onFileSelected: (file: File) => void;
  parsing: boolean;
  error: string | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
          dragActive
            ? "border-brand-400 bg-brand-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {parsing ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="text-sm font-medium text-slate-700">
              Reading file…
            </p>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <UploadCloud className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-slate-700">
              Drag and drop a file, or click to browse
            </p>
            <p className="text-xs text-slate-400">
              Supports .csv, .xlsx, and .xls — up to 500 leads per file
            </p>
          </>
        )}
      </div>
    </div>
  );
}
