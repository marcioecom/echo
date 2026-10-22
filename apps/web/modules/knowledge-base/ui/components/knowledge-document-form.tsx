"use client"

import { Cancel01Icon, File01Icon, TextIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { t, translateMessage } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { useKnowledgeDocumentForm } from "../../hooks/use-knowledge-document-form"
import { KnowledgeFilePicker } from "./knowledge-file-picker"

export function KnowledgeDocumentForm({
  organizationId,
  onCancel,
  onDone,
}: {
  organizationId: string
  onCancel: () => void
  onDone: () => void
}) {
  const { form, createMutation } = useKnowledgeDocumentForm({
    organizationId,
    onSuccess: onDone,
  })
  const sourceType = form.watch("sourceType")

  return (
    <section
      aria-labelledby="knowledge-compose-heading"
      className="rounded-md border border-border bg-background"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="space-y-1">
          <h2 className="text-sm font-medium" id="knowledge-compose-heading">
            {t("knowledge.addTitle")}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {t("knowledge.addBody")}
          </p>
        </div>
        <Button
          aria-label={t("knowledge.cancel")}
          onClick={onCancel}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} />
        </Button>
      </div>
      <div className="px-4 py-4">
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              createMutation.mutate(values)
            )}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("knowledge.titleLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder={t("knowledge.titlePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>{t("knowledge.source")}</FormLabel>
              <div
                aria-label={t("knowledge.source")}
                className="grid grid-cols-2 gap-2"
                role="group"
              >
                <SourceOption
                  description={t("knowledge.pastedTextHint")}
                  icon={TextIcon}
                  label={t("knowledge.pastedText")}
                  onSelect={() => form.setValue("sourceType", "text")}
                  selected={sourceType === "text"}
                />
                <SourceOption
                  description={t("knowledge.fileUploadHint")}
                  icon={File01Icon}
                  label={t("knowledge.fileUpload")}
                  onSelect={() => form.setValue("sourceType", "file")}
                  selected={sourceType === "file"}
                />
              </div>
            </FormItem>

            {sourceType === "text" ? (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("knowledge.content")}</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-40"
                        placeholder={t("knowledge.contentPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("knowledge.file")}</FormLabel>
                    <FormControl>
                      <KnowledgeFilePicker
                        disabled={createMutation.isPending}
                        file={field.value}
                        onFileChange={(file) => {
                          field.onChange(file)
                          field.onBlur()
                        }}
                      />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={createMutation.isPending} type="submit">
                {createMutation.isPending
                  ? t("knowledge.uploading")
                  : t("knowledge.add")}
              </Button>
              <Button onClick={onCancel} type="button" variant="ghost">
                {t("knowledge.cancel")}
              </Button>
            </div>
            {createMutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {translateMessage(createMutation.error.message)}
              </p>
            ) : null}
          </form>
        </Form>
      </div>
    </section>
  )
}

function SourceOption({
  description,
  icon,
  label,
  onSelect,
  selected,
}: {
  description: string
  icon: typeof TextIcon
  label: string
  onSelect: () => void
  selected: boolean
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
      onClick={onSelect}
      type="button"
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
        )}
      >
        <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-pretty text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}
