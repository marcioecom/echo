import { knowledgeBaseJobNames } from "@workspace/jobs"

import { handleIndexKnowledgeDocument } from "./index-knowledge-document"

export { retrieveKnowledge, type KnowledgeSnippet } from "./retrieve-knowledge"

export const knowledgeBaseProcessors = {
  [knowledgeBaseJobNames.indexKnowledgeDocument]: handleIndexKnowledgeDocument,
}
