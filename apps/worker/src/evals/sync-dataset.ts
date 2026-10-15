import type { Client } from "langsmith"
import type { Example } from "langsmith/schemas"

import {
  buildGoldenExamples,
  type GoldenExample,
} from "./datasets/golden-set-v1"
import { goldenDatasetName, goldenDatasetTag } from "./types"

const description =
  "Golden set v1 do agente de suporte da Echo. WhatsApp em pt-BR para padaria, clínica de estética, pet shop e loja de roupa. Fonte: apps/worker/src/evals/datasets/golden-set-v1."

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)])
    )
  }
  return value
}

function canonical(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function splitsOf(split: string | string[] | undefined): string[] {
  if (!split) return []
  const values = Array.isArray(split) ? split : [split]
  return [...values].sort()
}

function metadataMatches(
  stored: Example["metadata"],
  local: GoldenExample["metadata"]
) {
  if (!stored) return false
  return Object.entries(local).every(
    ([key, value]) => canonical(stored[key]) === canonical(value)
  )
}

function exampleChanged(stored: Example, local: GoldenExample): boolean {
  return (
    canonical(stored.inputs) !== canonical(local.inputs) ||
    canonical(stored.outputs) !== canonical(local.outputs) ||
    !metadataMatches(stored.metadata, local.metadata) ||
    canonical(splitsOf(stored.split)) !== canonical(splitsOf(local.split))
  )
}

export async function syncGoldenDataset(client: Client) {
  const exists = await client.hasDataset({ datasetName: goldenDatasetName })
  const dataset = exists
    ? await client.readDataset({ datasetName: goldenDatasetName })
    : await client.createDataset(goldenDatasetName, {
        description,
        dataType: "kv",
      })
  if (exists) {
    await client.updateDataset({ datasetId: dataset.id, description })
  }

  const stored = new Map<string, Example>()
  for await (const example of client.listExamples({ datasetId: dataset.id })) {
    stored.set(example.id, example)
  }

  const local = buildGoldenExamples()
  const wanted = new Set(local.map((example) => example.id))
  const toCreate = local.filter((example) => !stored.has(example.id))
  const toUpdate = local.filter((example) => {
    const current = stored.get(example.id)
    return current ? exampleChanged(current, example) : false
  })
  const toDelete = [...stored.keys()].filter((id) => !wanted.has(id))

  if (toCreate.length > 0) {
    await client.createExamples(
      toCreate.map((example) => ({
        id: example.id,
        dataset_id: dataset.id,
        inputs: example.inputs,
        outputs: example.outputs,
        metadata: example.metadata,
        split: example.split,
      }))
    )
  }
  if (toUpdate.length > 0) {
    await client.updateExamples(
      toUpdate.map((example) => ({
        id: example.id,
        dataset_id: dataset.id,
        inputs: example.inputs,
        outputs: example.outputs,
        metadata: example.metadata,
        split: example.split,
      }))
    )
  }
  if (toDelete.length > 0) {
    await client.deleteExamples(toDelete, { hardDelete: true })
  }

  const version = await client.readDatasetVersion({
    datasetId: dataset.id,
    asOf: new Date(),
  })
  await client.updateDatasetTag({
    datasetId: dataset.id,
    asOf: version.as_of,
    tag: goldenDatasetTag,
  })

  return {
    datasetId: dataset.id,
    asOf: version.as_of,
    created: toCreate.length,
    updated: toUpdate.length,
    deleted: toDelete.length,
    total: local.length,
  }
}
