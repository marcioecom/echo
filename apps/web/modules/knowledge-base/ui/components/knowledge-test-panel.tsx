"use client"

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

import { useKnowledgeTestQuery } from "../../hooks/use-knowledge-test-query"

export function KnowledgeTestPanel() {
  const { form, result, testMutation } = useKnowledgeTestQuery()

  return (
    <section
      aria-labelledby="knowledge-test-heading"
      className="space-y-4 rounded-md border border-border bg-background px-4 py-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-medium" id="knowledge-test-heading">
          {t("knowledge.test.title")}
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {t("knowledge.test.noCutoff")}
        </p>
      </div>
      <Form {...form}>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => testMutation.mutate(values))}
        >
          <FormField
            control={form.control}
            name="question"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("knowledge.test.question")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("knowledge.test.placeholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button disabled={testMutation.isPending} type="submit">
            {testMutation.isPending
              ? t("knowledge.test.submitting")
              : t("knowledge.test.submit")}
          </Button>
        </form>
      </Form>
      {testMutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {translateMessage(testMutation.error.message)}
        </p>
      ) : null}
      {result ? (
        result.hits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("knowledge.test.empty")}
          </p>
        ) : (
          <ol className="space-y-3">
            {result.hits.map((hit, index) => (
              <li
                className="space-y-1 rounded-md border border-border px-3 py-3"
                key={`${hit.documentId}-${index}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{hit.title}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("knowledge.test.score", {
                      score: hit.score.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">
                  {hit.excerpt}
                </p>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </section>
  )
}
