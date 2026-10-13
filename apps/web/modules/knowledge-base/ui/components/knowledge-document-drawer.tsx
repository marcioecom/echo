"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { t } from "@/lib/i18n"

import { useKnowledgeDocumentDetail } from "../../hooks/use-knowledge-document-detail"
import { knowledgeFailureMessage, knowledgeSourceLabel } from "../../labels"
import type {
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  KnowledgeDocumentStatus,
} from "../../types"
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
  const { query, page, setPage } = useKnowledgeDocumentDetail(document.id)
  const detail = query.data
  const shown = detail?.document ?? document
  const failure = knowledgeFailureMessage(shown.failureReason)

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="text-base">{shown.title}</SheetTitle>
          <KnowledgeDocumentStatusBadge status={shown.status} />
        </div>
        <SheetDescription>{knowledgeSourceLabel(shown)}</SheetDescription>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("knowledge.detail.revision", {
            revision: String(shown.revision),
          })}
        </p>
        {failure ? (
          <p className="text-sm text-destructive" role="alert">
            {failure}
          </p>
        ) : null}
      </SheetHeader>
      {detail ? (
        <DocumentTabs
          detail={detail}
          page={page}
          status={detail.document.status}
          onPage={setPage}
        />
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
        <p className="px-6 py-4 text-sm text-muted-foreground">
          {t("knowledge.detail.loading")}
        </p>
      )}
    </>
  )
}

function DocumentTabs({
  detail,
  page,
  status,
  onPage,
}: {
  detail: KnowledgeDocumentDetail
  page: number
  status: KnowledgeDocumentStatus
  onPage: (page: number) => void
}) {
  const pages = Math.max(
    1,
    Math.ceil(detail.chunks.total / detail.chunks.pageSize)
  )

  return (
    <Tabs className="min-h-0 flex-1 gap-0" defaultValue="content">
      <TabsList className="mx-6 mt-4">
        <TabsTrigger value="content">
          {t("knowledge.detail.contentTab")}
        </TabsTrigger>
        <TabsTrigger value="chunks">
          {t("knowledge.detail.chunksTab")} ({detail.chunks.total})
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="min-h-0 overflow-y-auto px-6 py-4"
        value="content"
      >
        <DocumentContent content={detail.document.content} status={status} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-y-auto px-6 py-4" value="chunks">
        {detail.chunks.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              status === "pending" || status === "processing"
                ? "knowledge.detail.chunksPending"
                : "knowledge.detail.chunksEmpty"
            )}
          </p>
        ) : (
          <ol className="space-y-3">
            {detail.chunks.items.map((chunk) => (
              <li
                key={chunk.id}
                className="rounded-md border border-border px-3 py-3"
              >
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <p className="text-xs font-medium">
                    {t("knowledge.detail.chunkLabel", {
                      ordinal: String(chunk.ordinal + 1),
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("knowledge.detail.characters", {
                      count: String(chunk.characterCount),
                    })}
                  </p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{chunk.content}</p>
              </li>
            ))}
          </ol>
        )}
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("knowledge.detail.pageStatus", {
                page: String(page),
                pages: String(pages),
              })}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("knowledge.detail.previous")}
              </Button>
              <Button
                disabled={page >= pages}
                onClick={() => onPage(page + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("knowledge.detail.next")}
              </Button>
            </div>
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
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
    return <p className="text-sm whitespace-pre-wrap">{content}</p>
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
