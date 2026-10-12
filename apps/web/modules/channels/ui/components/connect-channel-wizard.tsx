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
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { QrCodeIcon, WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { UseMutationResult } from "@tanstack/react-query"
import { toDataURL } from "qrcode"
import { useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"

import { channelErrorMessage } from "../../hooks/api"
import type {
  BaileysChannelValues,
  PairingCodeValues,
} from "../../hooks/use-baileys-pairing-form"
import type { ConnectChannelValues } from "../../hooks/use-connect-channel-form"
import type { ChannelLiveEvents } from "../../hooks/use-channel-events"
import type { ChannelsCopy } from "../../i18n"
import type { ChannelConnection } from "../../types"

export function ConnectChannelWizard({
  baileysEnabled,
  baileysForm,
  baileysMutation,
  copy,
  form,
  live,
  mutation,
  onCancel,
  onDone,
  pairingForm,
  pairingMutation,
}: {
  baileysEnabled: boolean
  baileysForm: UseFormReturn<BaileysChannelValues>
  baileysMutation: UseMutationResult<
    { channel: ChannelConnection },
    Error,
    BaileysChannelValues
  >
  copy: ChannelsCopy
  form: UseFormReturn<ConnectChannelValues>
  live: ChannelLiveEvents
  mutation: UseMutationResult<
    { channel: ChannelConnection },
    Error,
    ConnectChannelValues
  >
  onCancel: () => void
  onDone: () => void
  pairingForm: UseFormReturn<PairingCodeValues>
  pairingMutation: UseMutationResult<
    { accepted: boolean },
    Error,
    PairingCodeValues
  >
}) {
  const [step, setStep] = useState<"choose" | "twilio" | "baileys">("choose")
  const [copied, setCopied] = useState(false)
  const webhookUrl = mutation.data?.channel.webhookUrl

  if (mutation.isSuccess && webhookUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {copy.successTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{copy.successBody}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{copy.webhookLabel}</p>
            <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
              {webhookUrl}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(webhookUrl).then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2_000)
                })
              }}
              type="button"
              variant="outline"
            >
              {copied ? copy.copied : copy.copyWebhook}
            </Button>
            <Button onClick={onDone} type="button">
              {copy.done}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === "choose") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {copy.chooseTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            className="flex flex-col items-start gap-3 rounded-lg border border-primary/40 bg-background p-4 text-left transition-colors hover:bg-accent"
            onClick={() => setStep("twilio")}
            type="button"
          >
            <span className="flex w-full items-center justify-between gap-2">
              <HugeiconsIcon icon={WhatsappIcon} size={18} strokeWidth={1.8} />
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {copy.recommended}
              </span>
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-medium">
                {copy.officialTitle}
              </span>
              <span className="block text-xs text-pretty text-muted-foreground">
                {copy.officialBody}
              </span>
            </span>
          </button>
          <button
            className={
              baileysEnabled
                ? "flex flex-col items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-accent"
                : "flex flex-col items-start gap-3 rounded-lg border bg-muted/30 p-4 text-left opacity-70"
            }
            disabled={!baileysEnabled}
            onClick={() => setStep("baileys")}
            type="button"
          >
            <span className="flex w-full items-center justify-between gap-2">
              <HugeiconsIcon
                className="text-muted-foreground"
                icon={QrCodeIcon}
                size={18}
                strokeWidth={1.8}
              />
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {baileysEnabled ? copy.beta : copy.betaSoon}
              </span>
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-medium">{copy.qrTitle}</span>
              <span className="block text-xs text-pretty text-muted-foreground">
                {baileysEnabled ? copy.qrBodyEnabled : copy.qrBody}
              </span>
            </span>
          </button>
          <div className="sm:col-span-2">
            <Button onClick={onCancel} type="button" variant="ghost">
              {copy.cancel}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === "baileys") {
    const channelId = baileysMutation.data?.channel.id
    const qr =
      channelId && live.qr?.channelConnectionId === channelId
        ? live.qr.qr
        : null
    const pairingCode =
      channelId && live.pairingCode?.channelConnectionId === channelId
        ? live.pairingCode.pairingCode
        : null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{copy.qrTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{copy.qrRisk}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {channelId ? (
            <div className="space-y-3">
              {qr ? (
                <BaileysQrImage alt={copy.qrScan} value={qr} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {copy.qrWaiting}
                </p>
              )}
              <p className="text-sm text-muted-foreground">{copy.qrScan}</p>
              {pairingCode ? (
                <p className="space-y-1">
                  <span className="block text-xs font-medium">
                    {copy.pairingWaiting}
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
                          <FormLabel>{copy.pairingPhone}</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="tel"
                              inputMode="tel"
                              placeholder="+5511999999999"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {copy.pairingRequest}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {pairingMutation.isError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {channelErrorMessage(pairingMutation.error, copy)}
                      </p>
                    ) : null}
                    <Button
                      disabled={pairingMutation.isPending}
                      type="submit"
                      variant="outline"
                    >
                      {pairingMutation.isPending
                        ? copy.pairingSubmitting
                        : copy.pairingSubmit}
                    </Button>
                  </form>
                </Form>
              )}
              <Button onClick={onDone} type="button">
                {copy.done}
              </Button>
            </div>
          ) : (
            <Form {...baileysForm}>
              <form
                className="space-y-4"
                onSubmit={baileysForm.handleSubmit((values) =>
                  baileysMutation.mutate(values)
                )}
              >
                <FormField
                  control={baileysForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.displayName}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={copy.displayNamePlaceholder}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={baileysForm.control}
                  name="inboxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.inboxId}</FormLabel>
                      <FormControl>
                        <Input placeholder={copy.inboxPlaceholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {baileysMutation.isError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {channelErrorMessage(baileysMutation.error, copy)}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setStep("choose")}
                    type="button"
                    variant="outline"
                  >
                    {copy.back}
                  </Button>
                  <Button disabled={baileysMutation.isPending} type="submit">
                    {baileysMutation.isPending
                      ? copy.baileysSubmitting
                      : copy.baileysSubmit}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {copy.officialTitle}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{copy.officialBody}</p>
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
                  <FormLabel>{copy.displayName}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={copy.displayNamePlaceholder}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountSid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.accountSid}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="AC00000000000000000000000000000000"
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.authToken}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="new-password"
                      spellCheck={false}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {copy.tokenHint}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.address}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+5511999999999"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {copy.addressHint}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inboxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.inboxId}</FormLabel>
                  <FormControl>
                    <Input placeholder={copy.inboxPlaceholder} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {copy.inboxHint}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {channelErrorMessage(mutation.error, copy)}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={() => setStep("choose")}
                type="button"
                variant="outline"
              >
                {copy.back}
              </Button>
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? copy.submitting : copy.submit}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function BaileysQrImage({ alt, value }: { alt: string; value: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void toDataURL(value, { margin: 1, width: 240 }).then((url) => {
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
