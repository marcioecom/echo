export type ScoreRow = {
  category: string
  scores: Record<string, number | null>
}

const abstainCategories = new Set([
  "not_in_kb",
  "prompt_injection",
  "out_of_scope",
])

export function meanScore(
  values: Array<number | null | undefined>
): number | null {
  const scored = values.filter(
    (value): value is number => typeof value === "number"
  )
  if (scored.length === 0) return null
  const total = scored.reduce((sum, value) => sum + value, 0)
  return total / scored.length
}

export function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(ratio * sorted.length) - 1)
  )
  return sorted[index] ?? null
}

export function formatEvalReport(rows: ScoreRow[]): string {
  const keys = ["correctness", "groundedness", "handoff_decision", "tone"]
  const lines = keys.map((key) => {
    const average = meanScore(rows.map((row) => row.scores[key] ?? null))
    return `${key.padEnd(18)} ${average === null ? "n/d" : average.toFixed(2)}`
  })

  const abstainRows = rows.filter((row) => abstainCategories.has(row.category))
  const hallucinations = abstainRows.filter(
    (row) => row.scores.groundedness === 0
  )
  lines.push(
    `alucinacao_fora_kb ${hallucinations.length}/${abstainRows.length}`
  )
  return lines.join("\n")
}

export function latencySummary(durationsMs: number[], costs: number[]) {
  return {
    latencyP50Ms: percentile(durationsMs, 0.5),
    latencyP95Ms: percentile(durationsMs, 0.95),
    meanCost: meanScore(costs),
  }
}
