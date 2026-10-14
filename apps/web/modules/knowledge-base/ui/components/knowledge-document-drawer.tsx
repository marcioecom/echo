"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { toast } from "sonner"

import { t } from "@/lib/i18n"

import { useKnowledgeDocumentDetail } from "../../hooks/use-knowledge-document-detail"
import { useKnowledgeDocuments } from "../../hooks/use-knowledge-documents"
import { knowledgeFailureMessage, knowledgeSourceLabel } from "../../labels"
import type { KnowledgeDocument, KnowledgeDocumentStatus } from "../../types"
import { KnowledgeDocumentStatusBadge } from "./knowledge-document-status"

export function KnowledgeDocumentDrawer({
  document,
  onClose,
}: {
  document: KnowledgeDocument | null
  onClose: () => void
}) {
  return (
    <Sheet
      open={document !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        closeLabel={t("knowledge.detail.close")}
        id="knowledge-document-detail"
      >
        {document ? (
          <KnowledgeDocumentDetailBody key={document.id} document={document} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function KnowledgeDocumentDetailBody({
  document,
}: {
  document: KnowledgeDocument
}) {
  const { query } = useKnowledgeDocumentDetail(document.id)
  const { reindexMutation } = useKnowledgeDocuments()
  const detail = query.data
  const shown = detail?.document ?? document
  const failure = knowledgeFailureMessage(shown.failureReason)
  const reindexing =
    reindexMutation.isPending && reindexMutation.variables === document.id

  return (
    <>
      <SheetHeader className="border-b border-border pr-12">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="text-base text-balance">
            {shown.title}
          </SheetTitle>
          <KnowledgeDocumentStatusBadge status={shown.status} />
        </div>
        <SheetDescription>{knowledgeSourceLabel(shown)}</SheetDescription>
        {failure ? (
          <div className="mt-3 space-y-3 rounded-md bg-destructive/5 px-3 py-3">
            <p className="text-sm text-destructive" role="alert">
              {failure}
            </p>
            <Button
              disabled={reindexing}
              onClick={() =>
                reindexMutation.mutate(document.id, {
                  onSuccess: () => toast.success(t("knowledge.toast.reindex")),
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {reindexing ? t("knowledge.reindexing") : t("knowledge.reindex")}
            </Button>
          </div>
        ) : null}
      </SheetHeader>
      {detail ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <DocumentContent
            content={detail.document.content}
            status={detail.document.status}
          />
        </div>
      ) : query.isError ? (
        <div className="flex items-center gap-3 px-6 py-4">
          <p className="text-sm text-destructive" role="alert">
            {t("knowledge.detail.loadError")}
          </p>
          <Button onClick={() => query.refetch()} size="sm" variant="outline">
            {t("knowledge.retry")}
          </Button>
        </div>
      ) : (
        <DetailSkeleton />
      )}
    </>
  )
}

function DocumentContent({
  content,
  status,
}: {
  content: string | null
  status: KnowledgeDocumentStatus
}) {
  if (content) {
    return (
      <p className="max-w-prose text-sm leading-relaxed text-pretty whitespace-pre-wrap">
        {content}
      </p>
    )
  }
  const pending = status === "pending" || status === "processing"
  return (
    <p className="text-sm text-muted-foreground">
      {t(
        pending
          ? "knowledge.detail.contentPending"
          : "knowledge.detail.contentEmpty"
      )}
    </p>
  )
}

function DetailSkeleton() {
  return (
    <div
      aria-label={t("knowledge.detail.loading")}
      className="space-y-3 px-6 py-4"
    >
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-[92%] animate-pulse rounded bg-muted" />
      <div className="h-3 w-[88%] animate-pulse rounded bg-muted" />
      <div className="h-3 w-[70%] animate-pulse rounded bg-muted" />
    </div>
  )
}
