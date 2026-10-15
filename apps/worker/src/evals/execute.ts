import { awaitAllCallbacks } from "@langchain/core/callbacks/promises"
import { Client } from "langsmith"
import { evaluate } from "langsmith/evaluation"

import { env } from "../config/env"
import { database } from "../lib/db"
import { createSupportAgentModel } from "../processors/support-conversations/orchestration/support-agent-graph"
import { createGoldenEvaluators, latencyAndCostSummary } from "./evaluators"
import { formatEvalReport, type ScoreRow } from "./report"
import { syncGoldenDataset } from "./sync-dataset"
import { createDecideTarget } from "./target"
import { goldenDatasetName, goldenSetVersion } from "./types"

function asScore(score: number | boolean | null | undefined): number | null {
  if (typeof score === "number") return score
  if (score === true) return 1
  if (score === false) return 0
  return null
}

export async function executeEval(): Promise<void> {
  const client = new Client()
  try {
    const synced = await syncGoldenDataset(client)
    console.log(
      `Dataset ${goldenDatasetName} (tag ${goldenSetVersion}): ${synced.total} exemplos, ${synced.created} criados, ${synced.updated} atualizados, ${synced.deleted} removidos.`
    )

    const model = createSupportAgentModel()
    const results = await evaluate(createDecideTarget(model), {
      data: client.listExamples({
        datasetId: synced.datasetId,
        asOf: synced.asOf,
      }),
      evaluators: createGoldenEvaluators(model),
      summaryEvaluators: [latencyAndCostSummary],
      experimentPrefix: "echo-support-agent-baseline",
      description:
        "Baseline do fluxo decide do agente atual, com o contexto de retrieval fixo do golden set v1. Não muda o prompt nem o retrieval de produção.",
      maxConcurrency: 4,
      metadata: {
        goldenSetVersion,
        model: env.AI_CHAT_MODEL,
        flow: "decide",
      },
      client,
    })

    const rows: ScoreRow[] = results.results.map((row) => {
      const scores: Record<string, number | null> = {}
      for (const result of row.evaluationResults.results) {
        scores[result.key] = asScore(result.score)
      }
      const category = row.example.metadata?.category
      return {
        category: typeof category === "string" ? category : "unknown",
        scores,
      }
    })

    console.log(formatEvalReport(rows))
    for (const result of results.summaryResults.results) {
      const score = asScore(result.score)
      console.log(`${result.key.padEnd(18)} ${score === null ? "n/d" : score}`)
    }
    console.log(`Experimento: ${results.experimentName}`)
  } finally {
    await awaitAllCallbacks()
    await database.close()
  }
}
