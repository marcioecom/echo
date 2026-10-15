import type { KnowledgeChunk } from "./types"

export const retrievedChunkLimit = 6

export function buildRetrievedSnippets(
  chunks: KnowledgeChunk[],
  contextChunkIds: string[]
) {
  if (contextChunkIds.length === 0) {
    throw new Error("O caso precisa indicar ao menos um trecho de contexto.")
  }
  if (contextChunkIds.length > retrievedChunkLimit) {
    throw new Error(
      `O contexto do caso passa de ${retrievedChunkLimit} trechos.`
    )
  }
  if (new Set(contextChunkIds).size !== contextChunkIds.length) {
    throw new Error("O contexto do caso repete um trecho.")
  }

  const byId = new Map(chunks.map((item) => [item.id, item]))
  const selected = contextChunkIds.map((id) => {
    const found = byId.get(id)
    if (!found) throw new Error(`Trecho desconhecido no caso: ${id}`)
    return found
  })
  const selectedIds = new Set(contextChunkIds)
  const rest = chunks.filter((item) => !selectedIds.has(item.id))

  return [...selected, ...rest]
    .slice(0, retrievedChunkLimit)
    .map((item, index) => ({
      chunkId: item.id,
      documentId: item.documentId,
      documentTitle: item.documentTitle,
      content: item.content,
      similarity: Number((0.9 - index * 0.05).toFixed(2)),
    }))
}
