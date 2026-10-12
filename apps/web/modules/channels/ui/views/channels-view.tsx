"use client"

import { Button } from "@workspace/ui/components/button"
import { useEffect, useState } from "react"

import { PageHeader } from "@/modules/shell/ui/page-header"
import { useChannelEvents } from "../../hooks/use-channel-events"
import { useChannels } from "../../hooks/use-channels"
import { useConnectChannelForm } from "../../hooks/use-connect-channel-form"
import { useUpdateChannelForm } from "../../hooks/use-update-channel-form"
import { useChannelsCopy } from "../../i18n"
import { ChannelList } from "../components/channel-list"
import { ConnectChannelWizard } from "../components/connect-channel-wizard"

export function ChannelsView({ organizationId }: { organizationId: string }) {
  const { copy, locale } = useChannelsCopy()
  const channels = useChannels(organizationId)
  const live = useChannelEvents(organizationId)
  const connectForm = useConnectChannelForm(organizationId, copy)
  const updateForm = useUpdateChannelForm(organizationId, copy)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    document.title = copy.metaTitle
  }, [copy.metaTitle])

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          wizardOpen ? null : (
            <Button onClick={() => setWizardOpen(true)} type="button">
              {copy.add}
            </Button>
          )
        }
        description={copy.description}
        title={copy.title}
      />
      {wizardOpen ? (
        <ConnectChannelWizard
          copy={copy}
          form={connectForm.form}
          mutation={connectForm.mutation}
          onCancel={() => {
            connectForm.reset()
            setWizardOpen(false)
          }}
          onDone={() => {
            connectForm.reset()
            setWizardOpen(false)
          }}
        />
      ) : null}
      <ChannelList
        copy={copy}
        editError={updateForm.mutation.error}
        editForm={updateForm.form}
        editPending={updateForm.mutation.isPending}
        editingId={updateForm.editingId}
        isError={channels.query.isError}
        isFetching={channels.query.isFetching}
        isLoading={channels.query.isLoading}
        items={channels.query.data?.items}
        live={live}
        locale={locale}
        onActivate={(channelConnectionId) =>
          channels.activateMutation.mutate(channelConnectionId)
        }
        onCancelEdit={updateForm.cancel}
        onEdit={updateForm.edit}
        onRemove={(channelConnectionId) =>
          channels.removeMutation.mutate(channelConnectionId)
        }
        actionError={
          channels.removeMutation.error ?? channels.activateMutation.error
        }
        onRetry={() => void channels.query.refetch()}
        onSubmitEdit={(values) => updateForm.mutation.mutate(values)}
        pendingId={
          channels.removeMutation.isPending
            ? channels.removeMutation.variables
            : channels.activateMutation.isPending
              ? channels.activateMutation.variables
              : null
        }
      />
    </div>
  )
}
