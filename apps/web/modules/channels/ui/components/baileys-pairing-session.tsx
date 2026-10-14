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
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { channelErrorMessage, updateChannel } from "../../hooks/api"
import { useBaileysQrWait } from "../../hooks/use-baileys-qr-wait"
import { useChannelLive } from "../../hooks/use-channel-events"
import { channelQueryKeys } from "../../hooks/use-channels"
import { usePairingCodeForm } from "../../hooks/use-pairing-code-form"
import { BaileysQrPanel } from "./baileys-qr-panel"

export function BaileysPairingSession({
  channelId,
  organizationId,
  phoneNumber,
  onDone,
}: {
  channelId: string
  organizationId: string
  phoneNumber: string | null
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const live = useChannelLive()
  const { form, mutation } = usePairingCodeForm(channelId, phoneNumber)
  const wait = useBaileysQrWait({ organizationId, channelId })
  const pairingCode =
    live.pairingCode?.channelConnectionId === channelId
      ? live.pairingCode.pairingCode
      : null

  const retryMutation = useMutation({
    mutationFn: () => updateChannel(channelId, { status: "active" }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(organizationId),
      }),
  })

  return (
    <div className="space-y-3 rounded-md border bg-background p-3 text-foreground">
      <p className="text-sm">{t("channels.errors.pairingRequired")}</p>
      <p className="text-sm text-muted-foreground">{t("channels.qrRisk")}</p>
      <BaileysQrPanel
        onRetry={() => retryMutation.mutate()}
        retryPending={retryMutation.isPending}
        wait={wait}
      />
      {wait.status === "ready" ? (
        <p className="text-sm text-muted-foreground">{t("channels.qrScan")}</p>
      ) : null}
      {wait.status !== "failed" ? (
        pairingCode ? (
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
                disabled={mutation.isPending || wait.status !== "ready"}
                type="submit"
                variant="outline"
              >
                {mutation.isPending
                  ? t("channels.pairingSubmitting")
                  : t("channels.pairingSubmit")}
              </Button>
            </form>
          </Form>
        )
      ) : null}
      {retryMutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {channelErrorMessage(retryMutation.error)}
        </p>
      ) : null}
      <Button onClick={onDone} type="button" variant="ghost">
        {t("channels.done")}
      </Button>
    </div>
  )
}
