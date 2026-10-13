"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { BookOpen01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { t } from "@/lib/i18n"

import { useKnowledgeDocuments } from "../../hooks/use-knowledge-documents"
import { knowledgeFailureMessage, knowledgeSourceLabel } from "../../labels"
import type { KnowledgeDocument } from "../../types"
import { KnowledgeDocumentDrawer } from "./knowledge-document-drawer"
import { KnowledgeDocumentStatusBadge } from "./knowledge-document-status"

export function KnowledgeDocumentList() {
  const { documentsQuery, reindexMutation } = useKnowledgeDocuments()
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null)
  const items = documentsQuery.data?.items ?? []
  const openDocument =
    items.find((document) => document.id === selected?.id) ?? selected

  return (
    <section
      aria-labelledby="knowledge-documents-heading"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="knowledge-documents-heading" className="text-sm font-medium">
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
      ) : items.length > 0 ? (
        <div className="space-y-2">
          {items.map((document) => (
            <KnowledgeDocumentCard
              key={document.id}
              document={document}
              onOpen={() => setSelected(document)}
              onReindex={() => reindexMutation.mutate(document.id)}
              reindexing={
                reindexMutation.isPending &&
                reindexMutation.variables === document.id
              }
              selected={openDocument?.id === document.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
          <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.8} />
          </div>
          <p className="text-sm font-medium">{t("knowledge.emptyTitle")}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t("knowledge.emptyBody")}
          </p>
        </div>
      )}
      <KnowledgeDocumentDrawer
        document={openDocument}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}

function KnowledgeDocumentCard({
  document,
  onOpen,
  onReindex,
  reindexing,
  selected,
}: {
  document: KnowledgeDocument
  onOpen: () => void
  onReindex: () => void
  reindexing: boolean
  selected: boolean
}) {
  const failure = knowledgeFailureMessage(document.failureReason)

  return (
    <Card className={selected ? "ring-primary" : undefined}>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <button
          aria-controls="knowledge-document-detail"
          aria-expanded={selected}
          aria-label={t("knowledge.detail.open", { title: document.title })}
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          onClick={onOpen}
          type="button"
        >
          <p className="truncate text-sm font-medium">{document.title}</p>
          <p className="text-xs text-muted-foreground">
            {knowledgeSourceLabel(document)}
          </p>
          {failure ? (
            <p className="text-xs text-destructive">{failure}</p>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-3">
          <KnowledgeDocumentStatusBadge status={document.status} />
          {document.status === "failed" ? (
            <Button
              disabled={reindexing}
              onClick={onReindex}
              size="sm"
              type="button"
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
