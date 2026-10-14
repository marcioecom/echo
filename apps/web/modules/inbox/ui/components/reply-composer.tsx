"use client"

import { SentIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { useRef } from "react"

import { t, translateMessage } from "@/lib/i18n"

import { useReplyForm } from "../../hooks/use-reply-form"

export function ReplyComposer({
  organizationId,
  conversationId,
  disabled,
}: {
  organizationId: string
  conversationId: string
  disabled: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { form, replyMutation } = useReplyForm({
    organizationId,
    conversationId,
  })

  const submit = form.handleSubmit((values) => replyMutation.mutate(values))
  const bodyField = form.register("body")
  const bodyValue = form.watch("body")
  const canSend =
    !disabled && !replyMutation.isPending && Boolean(bodyValue.trim())

  return (
    <form
      className="border-t border-border bg-background px-4 py-3 sm:px-6"
      onSubmit={submit}
    >
      <div className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-end gap-2">
          <Textarea
            {...bodyField}
            ref={(element) => {
              bodyField.ref(element)
              textareaRef.current = element
            }}
            rows={2}
            disabled={disabled || replyMutation.isPending}
            aria-label={t("inbox.replyLabel")}
            placeholder={
              disabled ? t("inbox.replyDisabled") : t("inbox.replyPlaceholder")
            }
            className="min-h-[4.5rem] resize-none"
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return
              event.preventDefault()
              if (canSend) submit()
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label={t("inbox.send")}
          >
            <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={1.8} />
          </Button>
        </div>
        {form.formState.errors.body?.message ? (
          <p className="text-xs text-destructive" role="alert">
            {translateMessage(form.formState.errors.body.message)}
          </p>
        ) : disabled ? null : (
          <p className="text-[11px] text-muted-foreground">{t("inbox.replyHint")}</p>
        )}
      </div>
    </form>
  )
}
