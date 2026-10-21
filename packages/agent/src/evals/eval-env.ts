const defaultChatModel = "openai/gpt-6-luna"

const required = ["AI_GATEWAY_API_KEY", "LANGSMITH_API_KEY"] as const

export function prepareEvalEnv(): string[] {
  process.env.LANGSMITH_TRACING = "true"
  if (!process.env.LANGSMITH_PROJECT) {
    process.env.LANGSMITH_PROJECT = "echo"
  }
  if (!process.env.AI_CHAT_MODEL) {
    process.env.AI_CHAT_MODEL = defaultChatModel
  }
  return required.filter((key) => !process.env[key])
}

export function evalChatModel(): string {
  return process.env.AI_CHAT_MODEL ?? defaultChatModel
}
