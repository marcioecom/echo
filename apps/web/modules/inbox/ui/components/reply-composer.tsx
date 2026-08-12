"use client"

import { SentIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { useRef } from "react"

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

  return (
    <form
      className="border-t bg-background px-4 py-3 sm:px-6"
      onSubmit={submit}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          {...bodyField}
          ref={(element) => {
            bodyField.ref(element)
            textareaRef.current = element
          }}
          rows={2}
          disabled={disabled || replyMutation.isPending}
          aria-label="Reply to customer"
          placeholder={
            disabled
              ? "Replies are unavailable for resolved conversations."
              : "Write a reply..."
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            event.preventDefault()
            void submit()
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={
            disabled ||
            replyMutation.isPending ||
            !form.watch("body").trim()
          }
          aria-label="Send reply"
        >
          <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={1.8} />
        </Button>
      </div>
      {form.formState.errors.body ? (
        <p className="mx-auto mt-1 max-w-3xl text-xs text-destructive">
          {form.formState.errors.body.message}
        </p>
      ) : null}
    </form>
  )
}
