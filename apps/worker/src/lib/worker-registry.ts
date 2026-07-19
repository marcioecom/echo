import type { Worker } from "bullmq"

export class WorkerRegistry {
  readonly #workers: Worker[] = []

  register(worker: Worker): void {
    this.#workers.push(worker)
  }

  async close(): Promise<void> {
    await Promise.all(this.#workers.map((worker) => worker.close()))
  }
}
