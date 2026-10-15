import { prepareEvalEnv } from "./eval-env"

const missing = prepareEvalEnv()

if (missing.length > 0) {
  console.error(
    [
      "Faltam variáveis para publicar o experimento:",
      ...missing.map((key) => `- ${key}`),
      "",
      "Coloque em apps/worker/.env e rode de novo:",
      "pnpm --filter @workspace/worker eval",
    ].join("\n")
  )
  process.exit(1)
}

const { executeEval } = await import("./execute")

executeEval()
  .then(() => {
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
