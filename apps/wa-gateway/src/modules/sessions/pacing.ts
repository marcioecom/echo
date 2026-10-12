export interface ComposePacing {
  msPerChar: number
  minMs: number
  maxMs: number
}

export const defaultComposePacing: ComposePacing = {
  msPerChar: 30,
  minMs: 1_000,
  maxMs: 6_000,
}

export function humanSendDelayMs(
  body: string,
  pacing: ComposePacing = defaultComposePacing
): number {
  const scaled = body.length * pacing.msPerChar
  return Math.min(pacing.maxMs, Math.max(pacing.minMs, scaled))
}

export function reconnectDelayMs(
  attempt: number,
  random: () => number = Math.random
): number {
  const base = Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 5 * 60 * 1_000)
  return base + Math.floor(random() * 250)
}
