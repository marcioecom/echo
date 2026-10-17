"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { toast } from "sonner"
import { useRef, useState } from "react"

import { t, translateMessage } from "@/lib/i18n"

import { useDeleteKnowledgeDocument } from "../../hooks/use-delete-knowledge-document"
import { useKnowledgeDocumentDetail } from "../../hooks/use-knowledge-document-detail"
import { useKnowledgeDocuments } from "../../hooks/use-knowledge-documents"
import { useReplaceKnowledgeDocumentFile } from "../../hooks/use-replace-knowledge-document-file"
import { knowledgeFailureMessage, knowledgeSourceLabel } from "../../labels"
import type { KnowledgeDocument, KnowledgeDocumentStatus } from "../../types"
import { KnowledgeDocumentStatusBadge } from "./knowledge-document-status"
import { KnowledgeDocumentTextForm } from "./knowledge-document-text-form"

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
          <KnowledgeDocumentDetailBody
            document={document}
            key={document.id}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function KnowledgeDocumentDetailBody({
  document,
  onClose,
}: {
  document: KnowledgeDocument
  onClose: () => void
}) {
  const { query } = useKnowledgeDocumentDetail(document.id)
  const { reindexMutation } = useKnowledgeDocuments()
  const { deleteMutation } = useDeleteKnowledgeDocument({ onSuccess: onClose })
  const { replaceMutation } = useReplaceKnowledgeDocumentFile({
    documentId: document.id,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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
        {detail?.previousVersionActive ? (
          <p
            className="mt-3 rounded-md bg-muted px-3 py-3 text-sm text-pretty"
            role="status"
          >
            {t("knowledge.detail.previousStillActive")}
          </p>
        ) : null}
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
      <div className="flex flex-wrap gap-2 px-6 py-3">
        {shown.sourceType === "text" ? (
          <Button
            onClick={() => setEditing((current) => !current)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("knowledge.edit")}
          </Button>
        ) : (
          <Button
            disabled={replaceMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            {replaceMutation.isPending
              ? t("knowledge.replacing")
              : t("knowledge.replace")}
          </Button>
        )}
        <Button
          onClick={() => setConfirmingDelete(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("knowledge.delete")}
        </Button>
        {shown.sourceType === "file" ? (
          <input
            accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) replaceMutation.mutate(file)
            }}
            ref={fileInputRef}
            type="file"
          />
        ) : null}
      </div>
      {replaceMutation.isError ? (
        <p className="px-6 text-sm text-destructive" role="alert">
          {translateMessage(replaceMutation.error.message)}
        </p>
      ) : null}
      {editing && shown.sourceType === "text" ? (
        <KnowledgeDocumentTextForm
          content={detail?.document.content ?? ""}
          documentId={document.id}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
          title={shown.title}
        />
      ) : null}
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
      <AlertDialog onOpenChange={setConfirmingDelete} open={confirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("knowledge.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("knowledge.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("knowledge.cancel")}
            </AlertDialogCancel>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(document.id)}
              type="button"
              variant="destructive"
            >
              {t("knowledge.deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
