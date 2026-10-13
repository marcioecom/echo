import { describe, expect, it } from "vitest"

import type { KnowledgeSnippet } from "../../knowledge-base/retrieve-knowledge"
import {
  KnowledgeBaseRetriever,
  snippetsFromDocuments,
} from "./knowledge-retriever"

const snippet: KnowledgeSnippet = {
  chunkId: "01CHUNK000000000000000000",
  documentId: "01DOC00000000000000000000",
  documentTitle: "Horário",
  content: "Abrimos domingo das 9h às 13h.",
  similarity: 0.82,
}

describe("KnowledgeBaseRetriever", () => {
  it("returns retrieved chunks as documents without credentials", async () => {
    const retriever = new KnowledgeBaseRetriever({
      organizationId: "01ORGANIZATION000000000000",
      limit: 6,
      retrieveKnowledge: async (input) => {
        expect(input).toEqual({
          organizationId: "01ORGANIZATION000000000000",
          query: "vocês abrem domingo?",
          limit: 6,
        })
        return [snippet]
      },
    })

    const documents = await retriever.invoke("vocês abrem domingo?")

    expect(documents).toEqual([
      expect.objectContaining({
        id: snippet.chunkId,
        pageContent: snippet.content,
        metadata: {
          chunkId: snippet.chunkId,
          documentId: snippet.documentId,
          documentTitle: snippet.documentTitle,
          similarity: snippet.similarity,
        },
      }),
    ])
    expect(snippetsFromDocuments(documents)).toEqual([snippet])
    expect(JSON.stringify(documents)).not.toMatch(
      /api[_-]?key|ciphertext|nonce/i
    )
  })
})
