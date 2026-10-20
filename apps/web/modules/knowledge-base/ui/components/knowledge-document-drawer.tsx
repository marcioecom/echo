"use client"

import type { KnowledgeDocument, KnowledgeDocumentStatus } from "../../types"

import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { t, translateMessage } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { useDeleteKnowledgeDocument } from "../../hooks/use-delete-knowledge-document"
import { useKnowledgeDocumentDetail } from "../../hooks/use-knowledge-document-detail"
import { useKnowledgeDocumentTitleForm } from "../../hooks/use-knowledge-document-title-form"
import { useKnowledgeDocuments } from "../../hooks/use-knowledge-documents"
import { useReplaceKnowledgeDocumentFile } from "../../hooks/use-replace-knowledge-document-file"
import { knowledgeFailureMessage, knowledgeSourceLabel } from "../../labels"
import { KnowledgeDocumentStatusBadge } from "./knowledge-document-status"
import { KnowledgeDocumentTextForm } from "./knowledge-document-text-form"
import { KnowledgeFilePicker } from "./knowledge-file-picker"

type DrawerMode = "reading" | "editing" | "replacing" | "confirm-delete"

export function KnowledgeDocumentDrawer({
  document,
  onClose,
}: {
  document: KnowledgeDocument | null
  onClose: () => void
}) {
  const preventCloseRef = useRef(false)
  const setPreventClose = useCallback((prevent: boolean) => {
    preventCloseRef.current = prevent
  }, [])
  useEffect(() => {
    if (!document) setPreventClose(false)
  }, [document, setPreventClose])
  return (
    <Sheet
      open={document !== null}
      onOpenChange={(open) => {
        if (!open && !preventCloseRef.current) onClose()
      }}
    >
      <SheetContent
        closeLabel={t("knowledge.detail.close")}
        id="knowledge-document-detail"
        onEscapeKeyDown={(event) => {
          if (preventCloseRef.current) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (preventCloseRef.current) event.preventDefault()
        }}
      >
        {document ? (
          <KnowledgeDocumentDetailBody
            document={document}
            key={document.id}
            onClose={onClose}
            setPreventClose={setPreventClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function KnowledgeDocumentDetailBody({
  document,
  onClose,
  setPreventClose,
}: {
  document: KnowledgeDocument
  onClose: () => void
  setPreventClose: (prevent: boolean) => void
}) {
  const { query } = useKnowledgeDocumentDetail(document.id)
  const { reindexMutation } = useKnowledgeDocuments()
  const { deleteMutation } = useDeleteKnowledgeDocument({
    onSuccess: () => {
      setPreventClose(false)
      onClose()
    },
  })
  const { replaceMutation } = useReplaceKnowledgeDocumentFile({
    documentId: document.id,
  })
  const detail = query.data
  const shown = detail?.document ?? document
  const [mode, setMode] = useState<DrawerMode>("reading")
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const failure = knowledgeFailureMessage(shown.failureReason)
  const reindexing =
    reindexMutation.isPending && reindexMutation.variables === document.id
  const busy =
    replaceMutation.isPending || deleteMutation.isPending || reindexing

  useEffect(() => {
    setPreventClose(busy)
    return () => setPreventClose(false)
  }, [busy, setPreventClose])

  const previousMode = useRef<DrawerMode>(mode)
  useEffect(() => {
    if (mode === "confirm-delete") cancelDeleteRef.current?.focus()
    if (previousMode.current === "confirm-delete" && mode === "reading") {
      deleteTriggerRef.current?.focus()
    }
    previousMode.current = mode
  }, [mode])

  const exitMode = () => {
    setPreventClose(false)
    setReplacementFile(null)
    setMode("reading")
  }

  return (
    <>
      <SheetHeader className="border-b border-border pr-12">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="text-base text-balance break-all">
            {shown.title}
          </SheetTitle>
          <KnowledgeDocumentStatusBadge status={shown.status} />
        </div>
        <SheetDescription className="break-all">
          {knowledgeSourceLabel(shown)}
        </SheetDescription>
        {detail?.previousVersionActive ||
        (mode === "replacing" && shown.status === "ready") ||
        (mode === "replacing" &&
          (shown.status === "pending" || shown.status === "processing")) ? (
          <p
            className="mt-3 rounded-md bg-muted px-3 py-3 text-sm text-pretty"
            role="status"
          >
            {detail?.previousVersionActive
              ? t("knowledge.detail.previousStillActive")
              : shown.status === "ready"
                ? t("knowledge.detail.currentVersionAvailable")
                : t("knowledge.detail.replacementPending")}
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
      {mode === "reading" ? (
        <div className="flex flex-wrap gap-2 px-6 py-3">
          <Button
            disabled={!detail}
            onClick={() => setMode("editing")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("knowledge.edit")}
          </Button>
          {shown.sourceType === "file" ? (
            <Button
              disabled={busy}
              onClick={() => {
                replaceMutation.reset()
                setReplacementFile(null)
                setMode("replacing")
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("knowledge.replace")}
            </Button>
          ) : null}
          <Button
            ref={deleteTriggerRef}
            disabled={busy}
            onClick={() => {
              deleteMutation.reset()
              setMode("confirm-delete")
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("knowledge.delete")}
          </Button>
        </div>
      ) : null}
      {mode === "editing" && detail ? (
        shown.sourceType === "text" ? (
          <KnowledgeDocumentTextForm
            content={detail.document.content ?? ""}
            documentId={document.id}
            onCancel={exitMode}
            onDone={exitMode}
            onPendingChange={setPreventClose}
            title={shown.title}
          />
        ) : (
          <KnowledgeDocumentTitleForm
            documentId={document.id}
            onCancel={exitMode}
            onDone={exitMode}
            onPendingChange={setPreventClose}
            title={shown.title}
          />
        )
      ) : null}
      {mode === "replacing" ? (
        <section
          aria-labelledby="knowledge-replace-title"
          className="space-y-4 px-6 py-4"
        >
          <h2 className="text-sm font-medium" id="knowledge-replace-title">
            {t("knowledge.replace")}
          </h2>
          <p className="text-sm break-all text-muted-foreground">
            {t("knowledge.replaceSource", {
              source: shown.sourceName ?? shown.title,
            })}
          </p>
          <KnowledgeFilePicker
            disabled={replaceMutation.isPending}
            file={replacementFile}
            onFileChange={setReplacementFile}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!replacementFile || replaceMutation.isPending}
              onClick={() => {
                if (replacementFile)
                  replaceMutation.mutate(replacementFile, {
                    onSuccess: exitMode,
                  })
              }}
              type="button"
            >
              {replaceMutation.isPending
                ? t("knowledge.replacing")
                : t("knowledge.confirmReplace")}
            </Button>
            <Button
              disabled={replaceMutation.isPending}
              onClick={exitMode}
              type="button"
              variant="ghost"
            >
              {t("knowledge.cancel")}
            </Button>
          </div>
          {replaceMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {translateMessage(replaceMutation.error.message)}
            </p>
          ) : null}
        </section>
      ) : null}
      {mode === "confirm-delete" ? (
        <section
          aria-labelledby="knowledge-delete-title"
          className="space-y-4 px-6 py-4"
        >
          <div className="space-y-1">
            <h2 className="text-sm font-medium" id="knowledge-delete-title">
              {t("knowledge.deleteTitle", { title: shown.title })}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("knowledge.deleteBody")}
          </p>
          {deleteMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {translateMessage(deleteMutation.error.message)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(document.id)}
              type="button"
              variant="destructive"
            >
              {deleteMutation.isPending
                ? t("knowledge.deleting")
                : t("knowledge.deleteConfirm")}
            </Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={exitMode}
              ref={cancelDeleteRef}
              type="button"
              variant="ghost"
            >
              {t("knowledge.cancel")}
            </Button>
          </div>
        </section>
      ) : null}
      {mode === "reading" && detail ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <DocumentContent
            content={detail.document.content}
            status={detail.document.status}
          />
        </div>
      ) : mode === "reading" && query.isError ? (
        <div className="flex items-center gap-3 px-6 py-4">
          <p className="text-sm text-destructive" role="alert">
            {t("knowledge.detail.loadError")}
          </p>
          <Button onClick={() => query.refetch()} size="sm" variant="outline">
            {t("knowledge.retry")}
          </Button>
        </div>
      ) : mode === "reading" ? (
        <DetailSkeleton />
      ) : null}
    </>
  )
}

function KnowledgeDocumentTitleForm({
  documentId,
  onCancel,
  onDone,
  onPendingChange,
  title,
}: {
  documentId: string
  onCancel: () => void
  onDone: () => void
  onPendingChange: (pending: boolean) => void
  title: string
}) {
  const { form, saveMutation } = useKnowledgeDocumentTitleForm({
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
        <div className="flex flex-wrap gap-2">
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

function DocumentContent({
  content,
  status,
}: {
  content: string | null
  status: KnowledgeDocumentStatus
}) {
  if (content) {
    return (
      <p className="max-w-prose text-sm leading-relaxed text-pretty break-all whitespace-pre-wrap">
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
