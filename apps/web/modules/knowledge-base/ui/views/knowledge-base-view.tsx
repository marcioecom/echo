"use client"

import { Button } from "@workspace/ui/components/button"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { t } from "@/lib/i18n"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { KnowledgeDocumentForm } from "../components/knowledge-document-form"
import { KnowledgeDocumentList } from "../components/knowledge-document-list"
import { KnowledgeTestPanel } from "../components/knowledge-test-panel"

export function KnowledgeBaseView() {
  const [composing, setComposing] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          composing ? null : (
            <Button
              data-icon="inline-start"
              onClick={() => setComposing(true)}
              type="button"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
              {t("knowledge.add")}
            </Button>
          )
        }
        description={t("knowledge.description")}
        title={t("knowledge.title")}
      />
      {composing ? (
        <KnowledgeDocumentForm
          onCancel={() => setComposing(false)}
          onDone={() => setComposing(false)}
        />
      ) : null}
      <KnowledgeDocumentList onAdd={() => setComposing(true)} />
      <KnowledgeTestPanel />
    </div>
  )
}
