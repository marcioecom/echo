"use client"

import type { AgentDecision } from "../../types"

import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"

import { t, translateMessage } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { KnowledgeBaseApiError } from "../../hooks/api"
import { useKnowledgePreviewQuery } from "../../hooks/use-knowledge-test-query"

export function KnowledgeTestPanel() {
  const { form, result, previewMutation } = useKnowledgePreviewQuery()

  return (
    <section
      aria-labelledby="knowledge-test-heading"
      className="max-w-2xl space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-medium" id="knowledge-test-heading">
          {t("knowledge.test.title")}
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {t("knowledge.test.description")}
        </p>
      </div>
      <Form {...form}>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) =>
            previewMutation.mutate(values)
          )}
        >
          <FormField
            control={form.control}
            name="question"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("knowledge.test.question")}</FormLabel>
                <FormControl>
                  <Input
                    disabled={previewMutation.isPending}
                    placeholder={t("knowledge.test.placeholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button disabled={previewMutation.isPending} type="submit">
            {previewMutation.isPending
              ? t("knowledge.test.submitting")
              : t("knowledge.test.submit")}
          </Button>
        </form>
      </Form>
      {previewMutation.isError ? (
        previewMutation.error instanceof KnowledgeBaseApiError &&
        previewMutation.error.code === "ai_gateway_unavailable" ? (
          <p className="text-sm text-destructive" role="alert">
            {t("knowledge.test.aiGatewayUnavailable")}
          </p>
        ) : (
          <div className="space-y-1" role="alert">
            <p className="text-sm font-medium text-destructive">
              {t("knowledge.test.error")}
            </p>
            <p className="text-sm text-muted-foreground">
              {translateMessage(previewMutation.error.message)}
            </p>
          </div>
        )
      ) : null}
      {previewMutation.isPending ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="shrink-0 animate-spin motion-reduce:animate-none"
            icon={Loading03Icon}
            size={16}
            strokeWidth={1.8}
          />
          <span>{t("knowledge.test.loading")}</span>
        </div>
      ) : null}
      {result ? (
        <div aria-live="polite" className="space-y-4">
          <h3 className="text-sm font-medium">{t("knowledge.test.results")}</h3>
          <DecisionResult decision={result.decision} />
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
              {t("knowledge.test.sources")}
            </summary>
            <div className="px-3 pb-3">
              {result.hits.length === 0 ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {t("knowledge.test.empty")}
                </p>
              ) : (
                <ul className="divide-y">
                  {result.hits.map((hit, index) => (
                    <li
                      className="py-3 first:pt-1 last:pb-0"
                      key={`${hit.documentId}-${index}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium">{hit.title}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t("knowledge.test.score", {
                            score: hit.score.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            }),
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-pretty break-words whitespace-pre-wrap">
                        {hit.excerpt}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </div>
      ) : null}
    </section>
  )
}

function DecisionResult({ decision }: { decision: AgentDecision }) {
  switch (decision.action) {
    case "reply":
      return (
        <section className="space-y-2 rounded-md border border-border bg-background p-4">
          <h4 className="text-sm font-medium">
            {decision.replyType === "answer"
              ? t("knowledge.test.answer")
              : t("knowledge.test.clarification")}
          </h4>
          <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">
            {decision.body}
          </p>
        </section>
      )
    case "handoff":
      return (
        <section className="space-y-3 rounded-md border border-border bg-background p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">
              {t("knowledge.test.handoff")}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t("knowledge.test.handoffReason")}{" "}
              {handoffReasonLabel(decision.reason)}
            </p>
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-medium">
              {t("knowledge.test.customerMessage")}
            </h5>
            <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">
              {decision.customerMessage}
            </p>
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-medium">
              {t("knowledge.test.summary")}
            </h5>
            <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">
              {decision.summary}
            </p>
          </div>
        </section>
      )
    default: {
      const exhaustive: never = decision
      return exhaustive
    }
  }
}

function handoffReasonLabel(
  reason: Extract<AgentDecision, { action: "handoff" }>["reason"]
) {
  switch (reason) {
    case "human_requested":
      return t("knowledge.test.handoffReasons.humanRequested")
    case "low_confidence":
      return t("knowledge.test.handoffReasons.lowConfidence")
    case "unsupported_policy":
      return t("knowledge.test.handoffReasons.unsupportedPolicy")
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}
