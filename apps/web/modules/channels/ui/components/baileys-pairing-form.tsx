"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { channelErrorMessage, deleteChannel } from "../../hooks/api"
import { useBaileysPairingForm } from "../../hooks/use-baileys-pairing-form"
import { useBaileysQrWait } from "../../hooks/use-baileys-qr-wait"
import { useChannelLive } from "../../hooks/use-channel-events"
import {
  channelQueryKeys,
  isChannelConnected,
  useChannels,
} from "../../hooks/use-channels"
import { BaileysQrPanel } from "./baileys-qr-panel"
import { ChannelConnectedPanel } from "./channel-connected-panel"

export function BaileysPairingForm({
  organizationId,
  onBack,
  onDone,
}: {
  organizationId: string
  onBack: () => void
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { form, mutation, pairingForm, pairingMutation } =
    useBaileysPairingForm(organizationId)
  const live = useChannelLive()
  const channels = useChannels(organizationId)
  const channelId = mutation.data?.channel.id ?? null
  const channel =
    channels.data?.items.find((item) => item.id === channelId) ?? null
  const wait = useBaileysQrWait({ organizationId, channelId })
  const pairingCode = channelId
    ? (live.pairingCodeByChannelId[channelId] ?? null)
    : null

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!channelId) return
      await deleteChannel(channelId)
    },
    onSuccess: () => {
      mutation.reset()
      pairingForm.reset()
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(organizationId),
      }),
  })

  if (channel && isChannelConnected(channel)) {
    return (
      <ChannelConnectedPanel address={channel.address} onContinue={onDone} />
    )
  }

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
            <BaileysQrPanel
              onRetry={() => retryMutation.mutate()}
              retryPending={retryMutation.isPending}
              wait={wait}
            />
            {wait.status === "ready" ? (
              <p className="text-sm text-muted-foreground">
                {t("channels.qrScan")}
              </p>
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
                      disabled={
                        pairingMutation.isPending || wait.status !== "ready"
                      }
                      type="submit"
                      variant="outline"
                    >
                      {pairingMutation.isPending
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
