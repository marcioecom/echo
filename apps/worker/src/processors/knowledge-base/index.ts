import { knowledgeBaseJobNames } from "@workspace/jobs"

import { handleIndexKnowledgeDocument } from "./index-knowledge-document"

export const knowledgeBaseProcessors = {
  [knowledgeBaseJobNames.indexKnowledgeDocument]: handleIndexKnowledgeDocument,
}
