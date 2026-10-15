import type { Client } from "langsmith"
import { describe, expect, it, vi } from "vitest"

import { buildGoldenExamples } from "./datasets/golden-set-v1"
import { syncGoldenDataset } from "./sync-dataset"

const datasetId = "caec2728-7a86-4e28-9a31-c0dd7c594678"
const serverVersion = "2999-01-01T00:00:00.000Z"

describe("syncGoldenDataset", () => {
  it("tags the server's version after creating the golden examples", async () => {
    let examples: { id: string; modified_at: string }[] = []
    const readDatasetVersion = vi.fn(
      async ({ asOf }: { asOf: string | Date }) => {
        if (typeof asOf !== "string" || asOf < serverVersion) {
          throw new Error(
            'Failed to read dataset version. Received status [404]: Not Found. Message: {"detail":"Dataset version not found"}'
          )
        }
        return { as_of: serverVersion }
      }
    )
    const updateDatasetTag = vi.fn(
      async ({ asOf }: { asOf: string | Date }) => {
        if (asOf !== serverVersion)
          throw new Error("Tag requires the exact version")
      }
    )
    const client = {
      hasDataset: vi.fn(async () => false),
      createDataset: vi.fn(async () => ({ id: datasetId })),
      async *listExamples() {
        yield* examples
      },
      createExamples: vi.fn(async (uploads: { id: string }[]) => {
        examples = uploads.map(({ id }) => ({ id, modified_at: serverVersion }))
        return examples
      }),
      readDatasetVersion,
      updateDatasetTag,
    } as unknown as Client

    const result = await syncGoldenDataset(client)

    expect(result).toMatchObject({
      total: 40,
      created: 40,
      asOf: serverVersion,
    })
    expect(readDatasetVersion).toHaveBeenCalledWith({
      datasetId,
      asOf: serverVersion,
    })
    expect(updateDatasetTag).toHaveBeenCalledWith({
      datasetId,
      asOf: serverVersion,
      tag: "v1",
    })
  })

  it("uses the existing server version when a failed run already uploaded the examples", async () => {
    const examples = buildGoldenExamples().map((example) => ({
      ...example,
      created_at: serverVersion,
      modified_at: serverVersion,
    }))
    const readDatasetVersion = vi.fn(
      async ({ asOf }: { asOf: string | Date }) => {
        if (asOf !== serverVersion) throw new Error("Dataset version not found")
        return { as_of: serverVersion }
      }
    )
    const updateDatasetTag = vi.fn(async () => undefined)
    const client = {
      hasDataset: vi.fn(async () => true),
      readDataset: vi.fn(async () => ({ id: datasetId })),
      updateDataset: vi.fn(async () => undefined),
      async *listExamples() {
        yield* examples
      },
      readDatasetVersion,
      updateDatasetTag,
    } as unknown as Client

    const result = await syncGoldenDataset(client)

    expect(result).toMatchObject({
      total: 40,
      created: 0,
      updated: 0,
      deleted: 0,
      asOf: serverVersion,
    })
    expect(readDatasetVersion).toHaveBeenCalledWith({
      datasetId,
      asOf: serverVersion,
    })
    expect(updateDatasetTag).toHaveBeenCalledWith({
      datasetId,
      asOf: serverVersion,
      tag: "v1",
    })
  })
})
