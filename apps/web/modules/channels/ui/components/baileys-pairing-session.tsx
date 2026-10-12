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

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { channelErrorMessage } from "../../hooks/api"
import { useChannelLive } from "../../hooks/use-channel-events"
import { usePairingCodeForm } from "../../hooks/use-pairing-code-form"
import { BaileysQrImage } from "./baileys-qr-image"

export function BaileysPairingSession({
  channelId,
  phoneNumber,
  onDone,
}: {
  channelId: string
  phoneNumber: string | null
  onDone: () => void
}) {
  const live = useChannelLive()
  const { form, mutation } = usePairingCodeForm(channelId, phoneNumber)
  const qr = live.qr?.channelConnectionId === channelId ? live.qr.qr : null
  const pairingCode =
    live.pairingCode?.channelConnectionId === channelId
      ? live.pairingCode.pairingCode
      : null

  return (
    <div className="space-y-3 rounded-md border bg-background p-3 text-foreground">
      <p className="text-sm">{t("channels.errors.pairingRequired")}</p>
      <p className="text-sm text-muted-foreground">{t("channels.qrRisk")}</p>
      {qr ? (
        <BaileysQrImage alt={t("channels.qrScan")} value={qr} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("channels.qrWaiting")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t("channels.qrScan")}</p>
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
        <Form {...form}>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
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
            {mutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {channelErrorMessage(mutation.error)}
              </p>
            ) : null}
            <Button
              disabled={mutation.isPending}
              type="submit"
              variant="outline"
            >
              {mutation.isPending
                ? t("channels.pairingSubmitting")
                : t("channels.pairingSubmit")}
            </Button>
          </form>
        </Form>
      )}
      <Button onClick={onDone} type="button" variant="ghost">
        {t("channels.done")}
      </Button>
    </div>
  )
}
