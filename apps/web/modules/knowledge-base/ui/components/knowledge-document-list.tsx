"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  Add01Icon,
  BookOpen01Icon,
  File01Icon,
  TextIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

import { t } from "@/lib/i18n"

import { useKnowledgeDocuments } from "../../hooks/use-knowledge-documents"
import { knowledgeFailureMessage, knowledgeSourceLabel } from "../../labels"
import type { KnowledgeDocument, KnowledgeDocumentStatus } from "../../types"
import { KnowledgeDocumentDrawer } from "./knowledge-document-drawer"
import { KnowledgeDocumentStatusBadge } from "./knowledge-document-status"

type StatusFilter = "all" | "ready" | "working" | "failed"

export function KnowledgeDocumentList({ onAdd }: { onAdd: () => void }) {
  const { documentsQuery, reindexMutation } = useKnowledgeDocuments()
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("all")
  const items = documentsQuery.data?.items ?? []
  const openDocument =
    items.find((document) => document.id === selected?.id) ?? selected

  const counts = useMemo(() => {
    const next = { ready: 0, processing: 0, pending: 0, failed: 0 }
    for (const document of items) next[document.status] += 1
    return next
  }, [items])

  const visible = items.filter((document) =>
    matchesFilter(document.status, filter)
  )

  return (
    <section
      aria-labelledby="knowledge-documents-heading"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <h2
              id="knowledge-documents-heading"
              className="text-sm font-medium"
            >
              {t("knowledge.documents")}
            </h2>
            {items.length > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("knowledge.documentCount", { count: String(items.length) })}
              </span>
            ) : null}
          </div>
          {items.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("knowledge.summary", {
                ready: String(counts.ready),
                working: String(counts.pending + counts.processing),
                failed: String(counts.failed),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {documentsQuery.isFetching ? (
            <span className="text-xs text-muted-foreground">
              {t("knowledge.refreshing")}
            </span>
          ) : null}
          {items.length > 0 ? (
            <div
              aria-label={t("knowledge.filterLabel")}
              className="inline-flex rounded-md border border-border p-0.5"
              role="group"
            >
              {(
                [
                  ["all", t("knowledge.filter.all")],
                  ["ready", t("knowledge.status.ready")],
                  ["working", t("knowledge.filter.working")],
                  ["failed", t("knowledge.status.failed")],
                ] as const satisfies ReadonlyArray<
                  readonly [StatusFilter, string]
                >
              ).map(([value, label]) => {
                const active = filter === value
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      "rounded-[5px] px-2.5 py-1 text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={value}
                    onClick={() => setFilter(value)}
                    type="button"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      {documentsQuery.isLoading ? (
        <DocumentListSkeleton />
      ) : documentsQuery.isError ? (
        <div className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
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
      ) : items.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
          <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.8} />
          </div>
          <p className="text-sm font-medium">{t("knowledge.emptyTitle")}</p>
          <p className="mt-1 max-w-md text-sm text-pretty text-muted-foreground">
            {t("knowledge.emptyBody")}
          </p>
          <Button
            className="mt-4"
            data-icon="inline-start"
            onClick={onAdd}
            type="button"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
            {t("knowledge.add")}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">
            {t("knowledge.filterEmptyTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("knowledge.filterEmptyBody")}
          </p>
          <Button
            className="mt-3"
            onClick={() => setFilter("all")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("knowledge.filter.clear")}
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-md border border-border">
          {visible.map((document) => (
            <KnowledgeDocumentRow
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
        </ul>
      )}
      <KnowledgeDocumentDrawer
        document={openDocument}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}

function KnowledgeDocumentRow({
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
  const sourceIcon = document.sourceType === "file" ? File01Icon : TextIcon

  return (
    <li
      className={cn(
        "transition-colors duration-150",
        selected ? "bg-accent" : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-4 px-3 py-3">
        <button
          aria-controls="knowledge-document-detail"
          aria-expanded={selected}
          aria-label={t("knowledge.detail.open", { title: document.title })}
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          onClick={onOpen}
          type="button"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <HugeiconsIcon icon={sourceIcon} size={14} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {document.title}
                </span>
                <KnowledgeDocumentStatusBadge status={document.status} />
              </span>
              <span className="block text-xs text-muted-foreground">
                {knowledgeSourceLabel(document)}
                {" · "}
                {t("knowledge.detail.revision", {
                  revision: String(document.revision),
                })}
              </span>
              {failure ? (
                <span className="block text-xs text-destructive">
                  {failure}
                </span>
              ) : null}
            </span>
          </div>
        </button>
        {document.status === "failed" ? (
          <Button
            className="shrink-0"
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
    </li>
  )
}

function matchesFilter(status: KnowledgeDocumentStatus, filter: StatusFilter) {
  if (filter === "all") return true
  if (filter === "working")
    return status === "pending" || status === "processing"
  return status === filter
}

function DocumentListSkeleton() {
  return (
    <div
      aria-label={t("knowledge.loading")}
      className="divide-y rounded-md border border-border"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div className="flex items-start gap-3 px-3 py-3" key={index}>
          <div className="size-8 animate-pulse rounded-md bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
