"use client"

import { t } from "@/lib/i18n"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { KnowledgeDocumentForm } from "../components/knowledge-document-form"
import { KnowledgeDocumentList } from "../components/knowledge-document-list"

export function KnowledgeBaseView() {
  return (
    <>
      <PageHeader
        title={t("knowledge.title")}
        description={t("knowledge.description")}
      />
      <div className="space-y-8">
        <KnowledgeDocumentForm />
        <KnowledgeDocumentList />
      </div>
    </>
  )
}
