"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

import { t, translateMessage } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { useKnowledgeDocumentForm } from "../../hooks/use-knowledge-document-form"

export function KnowledgeDocumentForm() {
  const { form, createMutation } = useKnowledgeDocumentForm()
  const sourceType = form.watch("sourceType")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("knowledge.addTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("knowledge.addBody")}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              createMutation.mutate(values)
            )}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("knowledge.titleLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("knowledge.titlePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>{t("knowledge.source")}</FormLabel>
              <Select
                value={sourceType}
                onValueChange={(value: "text" | "file") => {
                  form.setValue("sourceType", value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    {t("knowledge.pastedText")}
                  </SelectItem>
                  <SelectItem value="file">
                    {t("knowledge.fileUpload")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
            {sourceType === "text" ? (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("knowledge.content")}</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-40"
                        placeholder={t("knowledge.contentPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("knowledge.file")}</FormLabel>
                    <FormControl>
                      <Input
                        accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        type="file"
                        onChange={(event) =>
                          field.onChange(event.target.files?.[0] ?? null)
                        }
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("knowledge.fileHint")}
                    </p>
                    <TranslatedFormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button disabled={createMutation.isPending} type="submit">
              {createMutation.isPending
                ? t("knowledge.uploading")
                : t("knowledge.add")}
            </Button>
            {createMutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {translateMessage(createMutation.error.message)}
              </p>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
