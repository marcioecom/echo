import { knowledgeBaseJobNames } from "@workspace/jobs"

import { handleDeleteKnowledgeObject } from "./delete-knowledge-object"
import { handleIndexKnowledgeDocument } from "./index-knowledge-document"

export const knowledgeBaseProcessors = {
  [knowledgeBaseJobNames.indexKnowledgeDocument]: handleIndexKnowledgeDocument,
  [knowledgeBaseJobNames.deleteKnowledgeObject]: handleDeleteKnowledgeObject,
}
