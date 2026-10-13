import { z } from "zod"

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export const defaultLangSmithProject = "echo"

export const langSmithEnvShape = {
  LANGSMITH_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional()
  ),
  LANGSMITH_PROJECT: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default(defaultLangSmithProject)
  ),
}

export function configureLangSmithTracing(input: {
  apiKey?: string
  project: string
}): void {
  if (!input.apiKey) {
    process.env.LANGSMITH_TRACING = "false"
    delete process.env.LANGSMITH_API_KEY
    return
  }

  process.env.LANGSMITH_TRACING = "true"
  process.env.LANGSMITH_API_KEY = input.apiKey
  process.env.LANGSMITH_PROJECT = input.project
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true"
}
