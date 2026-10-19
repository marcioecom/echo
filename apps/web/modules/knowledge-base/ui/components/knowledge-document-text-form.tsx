"use client"

import { useEffect } from "react"
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

import { t, translateMessage } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { useKnowledgeDocumentTextForm } from "../../hooks/use-knowledge-document-text-form"

export function KnowledgeDocumentTextForm({
  content,
  documentId,
  onCancel,
  onDone,
  onPendingChange,
  title,
}: {
  content: string
  documentId: string
  onCancel: () => void
  onDone: () => void
  onPendingChange: (pending: boolean) => void
  title: string
}) {
  const { form, saveMutation } = useKnowledgeDocumentTextForm({
    content,
    documentId,
    onSuccess: onDone,
    title,
  })
  useEffect(() => {
    onPendingChange(saveMutation.isPending)
  }, [onPendingChange, saveMutation.isPending])

  return (
    <Form {...form}>
      <form
        className="space-y-4 px-6 py-4"
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("knowledge.titleLabel")}</FormLabel>
              <FormControl>
                <Input disabled={saveMutation.isPending} {...field} />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("knowledge.content")}</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-64"
                  disabled={saveMutation.isPending}
                  {...field}
                />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={saveMutation.isPending} type="submit">
            {saveMutation.isPending
              ? t("knowledge.saving")
              : t("knowledge.save")}
          </Button>
          <Button
            disabled={saveMutation.isPending}
            onClick={onCancel}
            type="button"
            variant="ghost"
          >
            {t("knowledge.cancel")}
          </Button>
        </div>
        {saveMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {translateMessage(saveMutation.error.message)}
          </p>
        ) : null}
      </form>
    </Form>
  )
}
