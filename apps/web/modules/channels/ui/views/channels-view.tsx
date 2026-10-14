"use client"

import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
              <Button
                data-icon="inline-start"
                onClick={() => setWizardOpen(true)}
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
        {wizardOpen ? (
          <ConnectChannelWizard
            onClose={() => setWizardOpen(false)}
            organizationId={organizationId}
          />
        ) : null}
        <ChannelList
          onAdd={() => setWizardOpen(true)}
          organizationId={organizationId}
          wizardOpen={wizardOpen}
        />
      </div>
    </ChannelLiveProvider>
  )
}
