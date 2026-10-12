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
import { toDataURL } from "qrcode"
import { useEffect, useState } from "react"

import { TranslatedFormMessage } from "@/lib/i18n-form"
import { t } from "@/lib/i18n"

import { channelErrorMessage } from "../../hooks/api"
import { useBaileysPairingForm } from "../../hooks/use-baileys-pairing-form"
import { useChannelLive } from "../../hooks/use-channel-events"

export function BaileysPairingForm({
  organizationId,
  onBack,
  onDone,
}: {
  organizationId: string
  onBack: () => void
  onDone: () => void
}) {
  const { form, mutation, pairingForm, pairingMutation } =
    useBaileysPairingForm(organizationId)
  const live = useChannelLive()
  const channelId = mutation.data?.channel.id
  const qr =
    channelId && live.qr?.channelConnectionId === channelId ? live.qr.qr : null
  const pairingCode =
    channelId && live.pairingCode?.channelConnectionId === channelId
      ? live.pairingCode.pairingCode
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("channels.qrTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("channels.qrRisk")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {channelId ? (
          <div className="space-y-3">
            {qr ? (
              <BaileysQrImage alt={t("channels.qrScan")} value={qr} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("channels.qrWaiting")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("channels.qrScan")}
            </p>
            {pairingCode ? (
              <p className="space-y-1">
                <span className="block text-xs font-medium">
                  {t("channels.pairingWaiting")}
                </span>
                <span className="block font-mono text-lg tracking-widest">
                  {pairingCode}
                </span>
              </p>
            ) : (
              <Form {...pairingForm}>
                <form
                  className="space-y-3"
                  onSubmit={pairingForm.handleSubmit((values) =>
                    pairingMutation.mutate(values)
                  )}
                >
                  <FormField
                    control={pairingForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("channels.pairingPhone")}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="+5511999999999"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t("channels.pairingRequest")}
                        </p>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />
                  {pairingMutation.isError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {channelErrorMessage(pairingMutation.error)}
                    </p>
                  ) : null}
                  <Button
                    disabled={pairingMutation.isPending}
                    type="submit"
                    variant="outline"
                  >
                    {pairingMutation.isPending
                      ? t("channels.pairingSubmitting")
                      : t("channels.pairingSubmit")}
                  </Button>
                </form>
              </Form>
            )}
            <Button onClick={onDone} type="button">
              {t("channels.done")}
            </Button>
          </div>
        ) : (
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
                    ? t("channels.baileysSubmitting")
                    : t("channels.baileysSubmit")}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  )
}

function BaileysQrImage({ alt, value }: { alt: string; value: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    toDataURL(value, { margin: 1, width: 240 }).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  if (!src) return null
  return (
    <img
      alt={alt}
      className="size-60 rounded-md border bg-white p-2"
      src={src}
    />
  )
}
