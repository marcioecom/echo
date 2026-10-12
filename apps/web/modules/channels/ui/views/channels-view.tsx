"use client"

import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

import { t } from "@/lib/i18n"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { ChannelLiveProvider } from "../../hooks/use-channel-events"
import { ChannelList } from "../components/channel-list"
import { ConnectChannelWizard } from "../components/connect-channel-wizard"

export function ChannelsView({ organizationId }: { organizationId: string }) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <ChannelLiveProvider organizationId={organizationId}>
      <div className="space-y-6">
        <PageHeader
          actions={
            wizardOpen ? null : (
              <Button onClick={() => setWizardOpen(true)} type="button">
                {t("channels.add")}
              </Button>
            )
          }
          description={t("channels.description")}
          title={t("channels.title")}
        />
        {wizardOpen ? (
          <ConnectChannelWizard
            onClose={() => setWizardOpen(false)}
            organizationId={organizationId}
          />
        ) : null}
        <ChannelList organizationId={organizationId} />
      </div>
    </ChannelLiveProvider>
  )
}
