"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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

import { useKnowledgeDocumentForm } from "../../hooks/use-knowledge-document-form"
import type { KnowledgeDocument } from "../../types"

export function KnowledgeBaseView() {
  const { form, documentsQuery, createMutation, reindexMutation } =
    useKnowledgeDocumentForm()
  const [sourceType, setSourceType] = useState<"text" | "file">("text")

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Add knowledge</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add pasted text or one PDF, DOCX, Markdown, or plain-text file up to 10 MB.
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Support policy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Source</FormLabel>
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
                    <SelectItem value="text">Pasted text</SelectItem>
                    <SelectItem value="file">File upload</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
              {sourceType === "text" ? (
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-40"
                          placeholder="Paste the support information Echo can use."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value: _value, ...field } }) => (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                          type="file"
                          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Files upload directly to private storage before indexing.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <Button disabled={createMutation.isPending} type="submit">
                {createMutation.isPending ? "Uploading" : "Add knowledge"}
              </Button>
              {createMutation.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {createMutation.error.message}
                </p>
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>

      <section aria-labelledby="knowledge-documents-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="knowledge-documents-heading" className="text-sm font-medium">
            Documents
          </h2>
          {documentsQuery.isFetching ? (
            <span className="text-xs text-muted-foreground">Refreshing</span>
          ) : null}
        </div>
        {documentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents.</p>
        ) : documentsQuery.isError ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive" role="alert">
              Documents could not be loaded.
            </p>
            <Button onClick={() => documentsQuery.refetch()} size="sm" variant="outline">
              Retry
            </Button>
          </div>
        ) : documentsQuery.data?.items.length ? (
          <div className="space-y-2">
            {documentsQuery.data.items.map((document) => (
              <KnowledgeDocumentCard
                key={document.id}
                document={document}
                onReindex={() => reindexMutation.mutate(document.id)}
                reindexing={reindexMutation.isPending && reindexMutation.variables === document.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
            <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.8} />
            </div>
            <p className="text-sm font-medium">No knowledge yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Add support information here. Echo will use ready documents in first responses.
            </p>
          </div>
        )}
      </section>
    </div>
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
  const source = document.sourceType === "file" ? document.sourceName ?? "File" : "Pasted text"
  const failure = document.failureReason === "index_dispatch_failed"
    ? "Indexing could not be started."
    : document.failureReason === "indexing_failed"
      ? "Indexing failed."
      : null

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <p className="text-xs text-muted-foreground">{source}</p>
          {failure ? <p className="text-xs text-destructive">{failure}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted-foreground">{statusLabel(document.status)}</span>
          {document.status === "failed" ? (
            <Button disabled={reindexing} onClick={onReindex} size="sm" variant="outline">
              {reindexing ? "Reindexing" : "Reindex"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function statusLabel(status: KnowledgeDocument["status"]): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "processing":
      return "Processing"
    case "ready":
      return "Ready"
    case "failed":
      return "Failed"
  }
}
