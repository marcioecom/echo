"use client"

import { useFormField } from "@workspace/ui/components/form"

import { translateMessage } from "./i18n"

export function TranslatedFormMessage() {
  const { error, formMessageId } = useFormField()
  const message = error?.message
  if (!message) return null

  return (
    <p
      className="text-xs/relaxed text-destructive"
      data-slot="form-message"
      id={formMessageId}
    >
      {translateMessage(String(message))}
    </p>
  )
}
