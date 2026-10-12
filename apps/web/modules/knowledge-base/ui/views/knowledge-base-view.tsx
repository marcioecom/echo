"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { BookOpen01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { t, translateMessage, type MessageKey } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { useKnowledgeDocumentForm } from "../../hooks/use-knowledge-document-form"
import type { KnowledgeDocument } from "../../types"

const statusKeys = {
  pending: "knowledge.status.pending",
  processing: "knowledge.status.processing",
  ready: "knowledge.status.ready",
  failed: "knowledge.status.failed",
} as const satisfies Record<KnowledgeDocument["status"], MessageKey>

export function KnowledgeBaseView() {
  const { form, documentsQuery, createMutation, reindexMutation } =
    useKnowledgeDocumentForm()
  const [sourceType, setSourceType] = useState<"text" | "file">("text")

  return (
    <>
      <PageHeader
        title={t("knowledge.title")}
        description={t("knowledge.description")}
      />
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("knowledge.addTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("knowledge.addBody")}
            </p>
          </CardHeader>
          <CardContent>
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
                  <Select
                    value={sourceType}
                    onValueChange={(value: "text" | "file") => {
                      setSourceType(value)
                      form.setValue("sourceType", value)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        {t("knowledge.pastedText")}
                      </SelectItem>
                      <SelectItem value="file">
                        {t("knowledge.fileUpload")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                    render={({
                      field: { onChange, value: _value, ...field },
                    }) => (
                      <FormItem>
                        <FormLabel>{t("knowledge.file")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                            type="file"
                            onChange={(event) =>
                              onChange(event.target.files?.[0] ?? null)
                            }
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t("knowledge.fileHint")}
                        </p>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button disabled={createMutation.isPending} type="submit">
                  {createMutation.isPending
                    ? t("knowledge.uploading")
                    : t("knowledge.add")}
                </Button>
                {createMutation.isError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {translateMessage(createMutation.error.message)}
                  </p>
                ) : null}
              </form>
            </Form>
          </CardContent>
        </Card>

        <section
          aria-labelledby="knowledge-documents-heading"
          className="space-y-3"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="knowledge-documents-heading"
              className="text-sm font-medium"
            >
              {t("knowledge.documents")}
            </h2>
            {documentsQuery.isFetching ? (
              <span className="text-xs text-muted-foreground">
                {t("knowledge.refreshing")}
              </span>
            ) : null}
          </div>
          {documentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("knowledge.loading")}
            </p>
          ) : documentsQuery.isError ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive" role="alert">
                {t("knowledge.loadError")}
              </p>
              <Button
                onClick={() => documentsQuery.refetch()}
                size="sm"
                variant="outline"
              >
                {t("knowledge.retry")}
              </Button>
            </div>
          ) : documentsQuery.data?.items.length ? (
            <div className="space-y-2">
              {documentsQuery.data.items.map((document) => (
                <KnowledgeDocumentCard
                  key={document.id}
                  document={document}
                  onReindex={() => reindexMutation.mutate(document.id)}
                  reindexing={
                    reindexMutation.isPending &&
                    reindexMutation.variables === document.id
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
              <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HugeiconsIcon
                  icon={BookOpen01Icon}
                  size={18}
                  strokeWidth={1.8}
                />
              </div>
              <p className="text-sm font-medium">{t("knowledge.emptyTitle")}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t("knowledge.emptyBody")}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function KnowledgeDocumentCard({
  document,
  onReindex,
  reindexing,
}: {
  document: KnowledgeDocument
  onReindex: () => void
  reindexing: boolean
}) {
  const source =
    document.sourceType === "file"
      ? (document.sourceName ?? t("knowledge.file"))
      : t("knowledge.pastedText")
  const failure =
    document.failureReason === "index_dispatch_failed"
      ? t("knowledge.failure.index_dispatch_failed")
      : document.failureReason === "indexing_failed"
        ? t("knowledge.failure.indexing_failed")
        : null

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <p className="text-xs text-muted-foreground">{source}</p>
          {failure ? (
            <p className="text-xs text-destructive">{failure}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {statusLabel(document.status)}
          </span>
          {document.status === "failed" ? (
            <Button
              disabled={reindexing}
              onClick={onReindex}
              size="sm"
              variant="outline"
            >
              {reindexing ? t("knowledge.reindexing") : t("knowledge.reindex")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function statusLabel(status: KnowledgeDocument["status"]): string {
  return t(statusKeys[status])
}
