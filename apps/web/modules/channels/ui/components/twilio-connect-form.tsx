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
import { useState } from "react"

import { TranslatedFormMessage } from "@/lib/i18n-form"
import { t } from "@/lib/i18n"

import { channelErrorMessage } from "../../hooks/api"
import { useConnectChannelForm } from "../../hooks/use-connect-channel-form"

export function TwilioConnectForm({
  organizationId,
  onBack,
  onDone,
}: {
  organizationId: string
  onBack: () => void
  onDone: () => void
}) {
  const { form, mutation } = useConnectChannelForm(organizationId)
  const [copied, setCopied] = useState(false)
  const webhookUrl = mutation.data?.channel.webhookUrl

  if (mutation.isSuccess && webhookUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t("channels.successTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("channels.successBody")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t("channels.webhookLabel")}</p>
            <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
              {webhookUrl}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl).then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2_000)
                })
              }}
              type="button"
              variant="outline"
            >
              {copied ? t("channels.copied") : t("channels.copyWebhook")}
            </Button>
            <Button onClick={onDone} type="button">
              {t("channels.done")}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("channels.officialTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("channels.officialBody")}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("channels.displayName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("channels.displayNamePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountSid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("channels.accountSid")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="AC00000000000000000000000000000000"
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("channels.authToken")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="new-password"
                      spellCheck={false}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("channels.tokenHint")}
                  </p>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("channels.address")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+5511999999999"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("channels.addressHint")}
                  </p>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inboxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("channels.inboxId")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("channels.inboxPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("channels.inboxHint")}
                  </p>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            {mutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {channelErrorMessage(mutation.error)}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={onBack} type="button" variant="outline">
                {t("channels.back")}
              </Button>
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending
                  ? t("channels.submitting")
                  : t("channels.submit")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
