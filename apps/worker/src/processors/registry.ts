import { createLoggerWithContext } from "@workspace/logger"
import type { Processor } from "bullmq"

import { emailProcessors } from "./email"
import { supportConversationProcessors } from "./support-conversations"

const logger = createLoggerWithContext("worker:registry")

const processors: Map<string, Processor> = new Map()
const registered = {
  ...emailProcessors,
  ...supportConversationProcessors,
}

for (const [jobName, processor] of Object.entries(registered)) {
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
