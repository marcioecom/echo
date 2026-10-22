"use client"

import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { useChannelConnectionWizard } from "../../hooks/use-channel-connection-wizard"
import { ChannelLiveProvider } from "../../hooks/use-channel-events"
import { ChannelList } from "../components/channel-list"
import { ConnectChannelWizard } from "../components/connect-channel-wizard"

export function ChannelsView({ organizationId }: { organizationId: string }) {
  const wizard = useChannelConnectionWizard(organizationId)

  return (
    <ChannelLiveProvider organizationId={organizationId}>
      <div className="space-y-6">
        <PageHeader
          actions={
            wizard.open ? null : (
              <Button
                data-icon="inline-start"
                onClick={wizard.start}
                type="button"
              >
                <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
                {t("channels.add")}
              </Button>
            )
          }
          description={t("channels.description")}
          title={t("channels.title")}
        />
        {wizard.open ? (
          <ConnectChannelWizard
            onClose={wizard.close}
            organizationId={organizationId}
          />
        ) : null}
        <ChannelList
          onAdd={wizard.start}
          organizationId={organizationId}
          wizardOpen={wizard.open}
        />
      </div>
    </ChannelLiveProvider>
  )
}
