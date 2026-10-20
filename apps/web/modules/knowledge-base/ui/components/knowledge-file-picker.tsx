"use client"

import { Upload01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useRef, useState } from "react"

import { t } from "@/lib/i18n"

const ACCEPT =
  ".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"

type KnowledgeFilePickerProps = {
  file: File | null
  onFileChange: (file: File) => void
  disabled?: boolean
}

export function KnowledgeFilePicker({
  file,
  onFileChange,
  disabled = false,
}: KnowledgeFilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const selectFile = (nextFile: File | undefined) => {
    if (nextFile) onFileChange(nextFile)
  }

  return (
    <div>
      <input
        accept={ACCEPT}
        aria-label={t("knowledge.file")}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          selectFile(event.target.files?.[0])
          event.target.value = ""
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <button
        aria-label={
          file ? `${file.name}. ${t("knowledge.fileReplace")}` : undefined
        }
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-muted/50",
          file && "border-solid bg-muted/40",
          disabled && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) selectFile(event.dataTransfer.files?.[0])
        }}
        type="button"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={Upload01Icon} size={18} strokeWidth={1.8} />
        </span>
        {file ? (
          <>
            <span className="max-w-full text-sm font-medium break-all">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("knowledge.fileReplace")}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">
              {t("knowledge.fileDropTitle")}
            </span>
            <span className="max-w-sm text-xs text-pretty text-muted-foreground">
              {t("knowledge.fileHint")}
            </span>
          </>
        )}
      </button>
    </div>
  )
}
