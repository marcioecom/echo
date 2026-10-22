"use client"

import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { useState } from "react"

import { t } from "@/lib/i18n"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { KnowledgeDocumentForm } from "../components/knowledge-document-form"
import { KnowledgeDocumentList } from "../components/knowledge-document-list"
import { KnowledgeTestPanel } from "../components/knowledge-test-panel"

export function KnowledgeBaseView({
  organizationId,
}: {
  organizationId: string
}) {
  const [composing, setComposing] = useState(false)
  const [activeTab, setActiveTab] = useState("documents")

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          activeTab === "documents" && !composing ? (
            <Button
              data-icon="inline-start"
              onClick={() => setComposing(true)}
              type="button"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
              {t("knowledge.add")}
            </Button>
          ) : null
        }
        description={t("knowledge.description")}
        title={t("knowledge.title")}
      />
      <Tabs
        className="space-y-4"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <TabsList aria-label={t("knowledge.title")}>
          <TabsTrigger value="documents">
            {t("knowledge.tabs.documents")}
          </TabsTrigger>
          <TabsTrigger value="preview">
            {t("knowledge.tabs.preview")}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          forceMount
          hidden={activeTab !== "documents"}
          value="documents"
        >
          {composing ? (
            <KnowledgeDocumentForm
              organizationId={organizationId}
              onCancel={() => setComposing(false)}
              onDone={() => setComposing(false)}
            />
          ) : (
            <KnowledgeDocumentList onAdd={() => setComposing(true)} />
          )}
        </TabsContent>
        <TabsContent value="preview">
          <KnowledgeTestPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
