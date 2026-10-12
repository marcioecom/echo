"use client"

import type {
  ChannelConnectionStatus,
  ChannelProvider,
  ChannelSessionState,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { useState } from "react"

import { appLocale, t, type MessageKey } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { channelErrorMessage, humanChannelError } from "../../hooks/api"
import { useUpdateChannelForm } from "../../hooks/use-update-channel-form"
import type { ChannelConnection } from "../../types"

const providerKeys = {
  twilio: "channels.provider.twilio",
  baileys: "channels.provider.baileys",
  meta_cloud: "channels.provider.meta_cloud",
} as const satisfies Record<ChannelProvider, MessageKey>

const statusKeys = {
  active: "channels.status.active",
  pending: "channels.status.pending",
  disabled: "channels.status.disabled",
} as const satisfies Record<ChannelConnectionStatus, MessageKey>

const sessionKeys = {
  connecting: "channels.session.connecting",
  qr_pending: "channels.session.qr_pending",
  pairing_code_pending: "channels.session.pairing_code_pending",
  connected: "channels.session.connected",
  disconnected: "channels.session.disconnected",
  logged_out: "channels.session.logged_out",
  banned_suspected: "channels.session.banned_suspected",
} as const satisfies Record<ChannelSessionState, MessageKey>

export function ChannelRow({
  channel,
  organizationId,
  pending,
  onRemove,
  onActivate,
}: {
  channel: ChannelConnection
  organizationId: string
  pending: boolean
  onRemove: () => void
  onActivate: () => void
}) {
  const { form, mutation, editingId, edit, cancel } =
    useUpdateChannelForm(organizationId)
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const editing = editingId === channel.id
  const label = channel.displayName?.trim() || channel.name

  return (
    <li className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{label}</p>
            <ChannelStatusBadge channel={channel} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t(providerKeys[channel.provider])}
            {channel.address ? ` · ${channel.address}` : ""}
            {" · "}
            {channel.inboxId ?? t("channels.inboxEmpty")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {expanded ? t("channels.hideDetails") : t("channels.details")}
          </Button>
          <Button
            onClick={() => edit(channel)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("channels.edit")}
          </Button>
          {channel.status === "disabled" ? (
            <Button
              disabled={pending}
              onClick={onActivate}
              size="sm"
              type="button"
            >
              {t("channels.activate")}
            </Button>
          ) : (
            <Button
              disabled={pending}
              onClick={() => setConfirming(true)}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("channels.remove")}
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <Form {...form}>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("channels.displayName")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
            <div className="flex items-end gap-2">
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? t("channels.saving") : t("channels.save")}
              </Button>
              <Button onClick={cancel} type="button" variant="ghost">
                {t("channels.cancel")}
              </Button>
            </div>
          </form>
          {mutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {channelErrorMessage(mutation.error)}
            </p>
          ) : null}
        </Form>
      ) : null}

      {confirming ? (
        <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2">
          <p className="text-sm font-medium">{t("channels.confirmRemove")}</p>
          <p className="text-xs text-muted-foreground">
            {t("channels.confirmRemoveBody")}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() => {
                onRemove()
                setConfirming(false)
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("channels.confirm")}
            </Button>
            <Button
              onClick={() => setConfirming(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("channels.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {expanded ? <ChannelDetails channel={channel} /> : null}
    </li>
  )
}

function ChannelStatusBadge({ channel }: { channel: ChannelConnection }) {
  const tone = statusTone(channel)
  const label = channel.session
    ? t(sessionKeys[channel.session.state])
    : t(statusKeys[channel.status])
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "positive" && "bg-primary/10 text-primary",
        tone === "warning" && "bg-warning/20 text-warning-foreground",
        tone === "danger" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

function ChannelDetails({ channel }: { channel: ChannelConnection }) {
  const connectedAt = channel.session?.lastConnectedAt
  const error = channel.session?.lastError
  return (
    <dl className="grid gap-2 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">
          {t("channels.details")}
        </dt>
        <dd>{statusSentence(channel)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">
          {connectedAt ? t("channels.lastConnected") : t("channels.updatedAt")}
        </dt>
        <dd>
          {formatWhen(connectedAt ?? channel.updatedAt) ??
            t("channels.noLastConnection")}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">
          {t("channels.lastError")}
        </dt>
        <dd>{error ? humanChannelError(error) : t("channels.noLastError")}</dd>
      </div>
      {channel.webhookUrl ? (
        <div>
          <dt className="text-xs text-muted-foreground">
            {t("channels.webhookLabel")}
          </dt>
          <dd className="font-mono text-xs break-all">{channel.webhookUrl}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function statusSentence(channel: ChannelConnection) {
  if (channel.status === "disabled") return t("channels.disabledSentence")
  if (channel.status === "pending") return t("channels.pendingSentence")
  if (channel.session?.state === "logged_out") {
    return t("channels.session.logged_out")
  }
  if (channel.session?.state === "banned_suspected") {
    return t("channels.session.banned_suspected")
  }
  if (channel.session?.state === "disconnected") {
    return t("channels.session.disconnected")
  }
  return t("channels.connectedSentence")
}

function statusTone(channel: ChannelConnection) {
  const state = channel.session?.state
  if (state === "logged_out" || state === "banned_suspected") return "danger"
  if (
    state === "connecting" ||
    state === "qr_pending" ||
    state === "pairing_code_pending" ||
    channel.status === "pending"
  ) {
    return "warning"
  }
  if (state === "connected" || channel.status === "active") return "positive"
  return "muted"
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(appLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
