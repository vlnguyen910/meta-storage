"use client";

import { CloudUpload, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { useOperationalSettings } from "@/features/administration/use-system-settings";
import { managementError, useUploadCoverImage } from "./hooks";
import { F5 } from "./management.messages";

export function CoverImageField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const upload = useUploadCoverImage();
  const { data: operationalSettings } = useOperationalSettings();
  const maxMb = operationalSettings?.CLOUDINARY_MAX_UPLOAD_MB ?? 3;
  const [mode, setMode] = useState<"external" | "cloudinary">("external");
  const [uploadError, setUploadError] = useState<string>();

  const handleFile = async (file: File | undefined) => {
    setUploadError(undefined);
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > maxMb * 1024 * 1024
    ) {
      setUploadError(F5.coverFileError);
      return;
    }
    try {
      const result = await upload.mutateAsync({
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: await fileToBase64(file),
      });
      onChange(result.coverUrl);
    } catch (error) {
      const message = managementError(error);
      setUploadError(message === F5.saveError ? F5.coverUploadError : message);
    }
  };

  return (
    <div className="grid gap-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{F5.coverImage}</legend>
        <Button
          type="button"
          variant={mode === "external" ? "primary" : "outline"}
          aria-pressed={mode === "external"}
          onClick={() => setMode("external")}
          className="min-h-10"
        >
          <Link2 aria-hidden="true" className="size-4" />
          {F5.coverExternalMode}
        </Button>
        <Button
          type="button"
          variant={mode === "cloudinary" ? "primary" : "outline"}
          aria-pressed={mode === "cloudinary"}
          onClick={() => setMode("cloudinary")}
          className="min-h-10"
        >
          <CloudUpload aria-hidden="true" className="size-4" />
          {F5.coverUploadMode}
        </Button>
      </fieldset>
      {mode === "external" ? (
        <Input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="url"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com/anh-cover.jpg"
          aria-label={F5.coverUrl}
          aria-invalid={!value || undefined}
        />
      ) : (
        <label
          htmlFor={`${id}-file`}
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-primary hover:bg-primary-soft focus-within:ring-2 focus-within:ring-primary"
        >
          <input
            id={`${id}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void handleFile(file);
            }}
          />
          <CloudUpload aria-hidden="true" className="size-5 text-primary" />
          <span className="text-sm font-semibold text-slate-800">
            {upload.isPending ? F5.coverUploading : F5.coverUpload}
          </span>
          <span className="text-xs text-slate-500">JPEG, PNG hoặc WebP · tối đa {maxMb} MB</span>
        </label>
      )}
      {uploadError && (
        <p role="alert" className="text-xs font-medium text-danger">
          {uploadError}
        </p>
      )}
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="break-all text-xs text-primary underline underline-offset-2"
        >
          {F5.coverPreviewLink}
        </a>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(F5.coverUploadError));
        return;
      }
      const separator = reader.result.indexOf(",");
      resolve(reader.result.slice(separator + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error(F5.coverUploadError));
    reader.readAsDataURL(file);
  });
}
