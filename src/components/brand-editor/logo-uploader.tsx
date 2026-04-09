"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"

interface LogoUploaderProps {
  label: string
  description?: string
  value?: string
  ownerType: string
  ownerId?: string | null
  onChange: (url: string | undefined) => void
}

export function LogoUploader({
  label,
  description,
  value,
  ownerType,
  ownerId,
  onChange,
}: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!file.type.match(/^image\/(png|jpeg)$/)) {
        setError("File must be PNG or JPEG")
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        setError("File must be under 2MB")
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("ownerType", ownerType)
        if (ownerId) {
          formData.append("ownerId", ownerId)
        }

        const res = await fetch("/api/brand-assets/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Upload failed")
          return
        }

        onChange(data.url)
      } catch {
        setError("Upload failed — please try again")
      } finally {
        setIsUploading(false)
      }
    },
    [ownerType, ownerId, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset so same file can be re-selected
      e.target.value = ""
    },
    [handleFile]
  )

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-caption text-muted-foreground">{description}</p>
      )}

      {value ? (
        /* Has logo — show preview */
        <div className="relative flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Logo preview"
            className="max-h-20 w-auto object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        /* Empty or uploading — show dropzone */
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragOver
              ? "border-primary/50 bg-primary/5"
              : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30"
          }`}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="size-6 text-muted-foreground/60" />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Drop image or click to upload
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                PNG or JPG — max 2MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleSelect}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
