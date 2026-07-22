import { createLoggerWithContext } from "@workspace/logger"
import { emailProcessors } from "./email"
import { Processor } from "bullmq"

const logger = createLoggerWithContext("worker:registry")

const processors: Map<string, Processor> = new Map()

for (const [jobName, processor] of Object.entries(emailProcessors)) {
  processors.set(jobName, processor)
}

logger.info("Registered processors", {
  processors: Array.from(processors.keys()),
})

export function getProcessor(jobName: string) {
  const processor = processors.get(jobName)
  if (!processor) {
    logger.error(`Processor not found for job ${jobName}`)
  }
  return processor
}
